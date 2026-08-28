import { db, withAuthDb } from "../../config/drizzle.ts";
import { redis } from "../../config/redis.ts";
import { getEnv } from "../../config/env.ts";
import { getSupabaseAdmin, getSupabaseAnon } from "../../config/supabase.ts";
import { stripe } from "../../config/stripe.ts";
import { vectorIndex } from "../../config/vector.ts";
import { deleteObject } from "../../shared/utils/s3.util.ts";
import { logActivity } from "../../shared/utils/activity.util.ts";
import { sendAccountDeletedEmail } from "../../shared/utils/email.util.ts";
import {
  accountDeletionJobs,
  chatShares,
  conversationTurns,
  conversations,
  documentChunks,
  documents,
  loginAttempts,
  outboxEvents,
  tenantKeys,
  tenants,
  tenantSubscriptions,
  turnAlternatives,
  users,
} from "../../shared/models/db.model.ts";
import { and, eq, inArray, lt, ne, or, sql } from "drizzle-orm";
import { AppError } from "../../shared/utils/errors.util.ts";
import * as MeParams from "./me.schema.ts";
import {
  TIER_LIMITS,
  type TierType,
} from "../../shared/constants/tiers.constant.ts";

/**
 * Redis tombstone key for a deleted / deletion-pending user. Kept in sync with
 * the auth middleware: while it exists, the user's still-valid JWTs are
 * rejected. TTL matches the max access token lifetime.
 */
const deletedUserTombstone = (userId: string) => `deleted_user:${userId}`;
const DELETED_USER_TOMBSTONE_TTL_SECONDS = 60 * 60; // 1h

// Give up on a job after this many sweep attempts so an unrecoverable failure
// does not hammer external services forever. The job stays in 'failed' for
// ops to inspect (last_error) and re-queue manually.
const MAX_JOB_ATTEMPTS = 20;

/**
 * Best-effort: asks the STB worker to stop any queued/active ingestion job for
 * a document. Failures are logged and never block the purge.
 */
async function cancelIngestionOnWorker(params: {
  documentId: string;
  logContext?: Record<string, any>;
}): Promise<void> {
  try {
    const res = await fetch(`${getEnv("STB_WORKER_URL")}/api/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Worker-Secret": getEnv("STB_WORKER_SECRET"),
      },
      body: JSON.stringify({ document_id: params.documentId }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok && params.logContext) {
      params.logContext.workerCancelError = `HTTP ${res.status}`;
    }
  } catch (err: any) {
    if (params.logContext) {
      params.logContext.workerCancelError =
        "Failed to reach STB Worker: " + err.message;
    }
  }
}

export class MeService {
  static async getProfile(params: {
    userId: string;
    tenantId: string;
    logContext?: Record<string, any>;
  }): Promise<MeParams.ProfileResponse> {
    const [userRecord] = await db
      .select()
      .from(users)
      .where(
        and(eq(users.id, params.userId), eq(users.tenantId, params.tenantId)),
      );

    if (!userRecord) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "User not found",
        status: 404,
      });
    }

    const [tenantRecord] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, params.tenantId));

    if (!tenantRecord) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Tenant not found",
        status: 404,
      });
    }

    const [subscription] = await db
      .select()
      .from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, params.tenantId));

    if (!subscription) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Subscription not found",
        status: 404,
      });
    }

    let currentTier = subscription.tier;
    let expiresAt = subscription.expiresAt;

    // Lazy Evaluation: Auto-Downgrade
    if (expiresAt && new Date() > expiresAt && currentTier !== "FREE") {
      currentTier = "FREE";
      expiresAt = null;

      await db
        .update(tenantSubscriptions)
        .set({
          tier: "FREE",
          expiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(tenantSubscriptions.tenantId, params.tenantId));

      if (params.logContext) {
        params.logContext.meEvent = "tier_auto_downgraded";
        params.logContext.oldTier = subscription.tier;
      }
    }

    return {
      user: {
        id: userRecord.id,
        email: userRecord.email,
        profilePictureUrl: userRecord.profilePictureUrl,
      },
      tenant: {
        id: tenantRecord.id,
        name: tenantRecord.name,
      },
      subscription: {
        tier: currentTier,
        expiresAt: expiresAt?.toISOString() || null,
      },
    };
  }

  static async getUsage(params: {
    tenantId: string;
    userId: string;
    logContext?: Record<string, any>;
  }): Promise<MeParams.UsageResponse> {
    const [subscription] = await withAuthDb(params.userId, async (tx) => {
      return await tx
        .select({
          tier: tenantSubscriptions.tier,
          expiresAt: tenantSubscriptions.expiresAt,
          uploadsCount: tenantSubscriptions.uploadsCount,
          searchesCount: tenantSubscriptions.searchesCount,
          qaCount: tenantSubscriptions.qaCount,
          storageUsedBytes: tenantSubscriptions.storageUsedBytes,
        })
        .from(tenantSubscriptions)
        .where(eq(tenantSubscriptions.tenantId, params.tenantId));
    });

    if (!subscription) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Subscription not found",
        status: 404,
      });
    }

    const rawTier = (subscription.tier as TierType) ?? "FREE";
    const tier: TierType = TIER_LIMITS[rawTier] ? rawTier : "FREE";

    if (params.logContext) {
      params.logContext.meEvent = "get_usage_success";
      params.logContext.tier = tier;
    }

    return {
      tier,
      expiresAt: subscription.expiresAt?.toISOString() ?? null,
      uploadsCount: subscription.uploadsCount,
      searchesCount: subscription.searchesCount,
      qaCount: subscription.qaCount,
      storageUsedBytes: subscription.storageUsedBytes,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Account Deletion (async purge)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * True when the user row exists and is fully active. Used by the login and
   * OAuth flows to reject deleted / deletion-pending accounts at the
   * application layer, even though Supabase still accepts their credentials
   * until the async purge deletes the auth identity.
   */
  static async isUserActive(userId: string): Promise<boolean> {
    const [row] = await db
      .select({ deletionStatus: users.deletionStatus })
      .from(users)
      .where(eq(users.id, userId));
    return row?.deletionStatus === "active";
  }

  /**
   * Synchronous part of account deletion: validates the account, marks the
   * user + tenant as deletion_pending, enqueues the async purge job, revokes
   * all Supabase sessions, and tombstones the Redis cache so in-flight JWTs
   * stop working immediately. Returns 202 semantics to the caller.
   */
  static async requestAccountDeletion(params: {
    userId: string;
    tenantId: string;
    clientIp?: string;
    userAgent?: string;
    requestId?: string;
    logContext?: Record<string, any>;
  }): Promise<{ scheduled: boolean; jobId: string }> {
    const { userId, tenantId, logContext } = params;

    // 1. Idempotency first: a deletion already in flight returns the same
    //    job even though the user/tenant are now deletion_pending.
    const [existing] = await db
      .select({ id: accountDeletionJobs.id })
      .from(accountDeletionJobs)
      .where(
        and(
          eq(accountDeletionJobs.userId, userId),
          inArray(accountDeletionJobs.status, ["pending", "purging"]),
        ),
      )
      .limit(1);
    if (existing) {
      return { scheduled: true, jobId: existing.id };
    }

    // 2. The account must exist and be fully active (a deleted account can
    //    never be requested again).
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.deletionStatus, "active")));
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(
        and(eq(tenants.id, tenantId), eq(tenants.deletionStatus, "active")),
      );

    if (!user || !tenant) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Account not found or already deleted",
        status: 404,
      });
    }

    // 3. Create the job and flip user + tenant to deletion_pending (atomic).
    let jobId: string;
    await db.transaction(async (tx) => {
      const [job] = await tx
        .insert(accountDeletionJobs)
        .values({ tenantId, userId })
        .returning({ id: accountDeletionJobs.id });
      jobId = job.id;

      await tx
        .update(users)
        .set({ deletionStatus: "deletion_pending", updatedAt: new Date() })
        .where(eq(users.id, userId));
      await tx
        .update(tenants)
        .set({ deletionStatus: "deletion_pending", updatedAt: new Date() })
        .where(eq(tenants.id, tenantId));
    });

    // 4. Revoke all Supabase sessions immediately (best-effort). Deleting a
    // user does NOT invalidate already-issued access tokens, so this has to
    // happen now, before the async purge — the tombstone below covers the
    // remaining token lifetime.
    try {
      await getSupabaseAdmin().auth.admin.signOut(userId, "global");
    } catch (err: any) {
      if (logContext) {
        logContext.signOutError =
          "Failed to revoke sessions on deletion request: " + err.message;
      }
    }

    // 5. Kill cached lookups + tombstone the user in Redis.
    try {
      await redis.del(`tenant_map:${userId}`, `welcome_email:${userId}`);
      await redis.set(deletedUserTombstone(userId), "1", {
        ex: DELETED_USER_TOMBSTONE_TTL_SECONDS,
      });
    } catch (err: any) {
      if (logContext) {
        logContext.redisError = "Failed to tombstone user: " + err.message;
      }
    }

    // 6. Audit the request.
    await logActivity(
      {
        tenantId,
        userId,
        action: "account.deletion_requested",
        ipAddress: params.clientIp,
        userAgent: params.userAgent,
        requestId: params.requestId,
      },
      logContext,
    );

    if (logContext) {
      logContext.accountDeletion = { jobId, status: "pending" };
    }

    return { scheduled: true, jobId };
  }

  /**
   * Idempotent purge of one job. Every step tolerates being re-run: external
   * deletions are best-effort, the database transaction is the only
   * authoritative state change, and it is executed last.
   */
  static async processJob(jobId: string): Promise<void> {
    // 5 minutes lock threshold for reclaiming abandoned jobs in 'purging'
    const staleLockThreshold = new Date(Date.now() - 5 * 60 * 1000);

    // Atomically claim the job. If another worker/cron instance is currently
    // processing this job, this update matches 0 rows and returns undefined.
    const [claimedJob] = await db
      .update(accountDeletionJobs)
      .set({
        status: "purging",
        attemptCount: sql`${accountDeletionJobs.attemptCount} + 1`,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(accountDeletionJobs.id, jobId),
          or(
            eq(accountDeletionJobs.status, "pending"),
            and(
              eq(accountDeletionJobs.status, "purging"),
              lt(accountDeletionJobs.updatedAt, staleLockThreshold),
            ),
          ),
        ),
      )
      .returning();

    if (!claimedJob) return;

    try {
      await MeService.purgeTenant({
        jobId,
        userId: claimedJob.userId,
        tenantId: claimedJob.tenantId,
      });
      await db
        .update(accountDeletionJobs)
        .set({
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(accountDeletionJobs.id, jobId));
    } catch (err: any) {
      const lastError = err instanceof Error ? err.message : String(err);
      const status =
        claimedJob.attemptCount >= MAX_JOB_ATTEMPTS ? "failed" : "purging";
      await db
        .update(accountDeletionJobs)
        .set({
          status,
          lastError,
          updatedAt: new Date(),
        })
        .where(eq(accountDeletionJobs.id, jobId));
    }
  }

  /**
   * The actual purge. Order matters:
   *   1. external cancellations (Stripe, STB worker)
   *   2. external data deletion (vector, S3)
   *   3. database purge + anonymize + soft delete (authoritative, atomic)
   *   4. cache cleanup + Supabase auth user removal
   * After step 3 the account is terminal; re-running any earlier step is a
   * harmless no-op.
   */
  private static async purgeTenant(params: {
    jobId: string;
    userId: string;
    tenantId: string;
  }): Promise<void> {
    const { jobId, userId, tenantId } = params;

    // ── 1. Cancel Stripe subscriptions (best-effort) ───────────────────
    const [sub] = await db
      .select()
      .from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId));

    const cancelSubscription = async (subscriptionId: string) => {
      try {
        await stripe.subscriptions.cancel(subscriptionId);
      } catch {
        // Already canceled / expired / unknown — the terminal DB state
        // below is what matters.
      }
    };

    // 1a. The subscription we know about (normal path).
    if (sub?.stripeSubscriptionId) {
      await cancelSubscription(sub.stripeSubscriptionId);
    }

    // 1b. ANY other active subscription for this customer. Closes the race
    // where a checkout was completed after the deletion request: its
    // subscription id was never stored (provisioning is skipped for
    // non-active tenants), so without this sweep the customer would keep
    // being billed every period with no account behind it.
    if (sub?.stripeCustomerId) {
      try {
        const { data: subscriptions } = await stripe.subscriptions.list({
          customer: sub.stripeCustomerId,
          limit: 100,
        });
        for (const subscription of subscriptions) {
          if (
            subscription.status === "active" ||
            subscription.status === "trialing" ||
            subscription.status === "past_due" ||
            subscription.status === "unpaid"
          ) {
            await cancelSubscription(subscription.id);
          }
        }
      } catch {
        // Best-effort — the payment ledger below still records the trail.
      }
    }

    // ── 2. Cancel queued/active STB ingestion jobs (best-effort) ───────
    const pendingDocs = await db
      .select({ id: documents.id })
      .from(documents)
      .where(
        and(
          eq(documents.tenantId, tenantId),
          ne(documents.status, "processed"),
        ),
      );
    await Promise.allSettled(
      pendingDocs.map((doc) => cancelIngestionOnWorker({ documentId: doc.id })),
    );

    // ── 3. Delete vector embeddings (Upstash Vector) ───────────────────
    // Best-effort like S3: a stale/failing vector store must not block the
    // account from reaching its terminal deleted state.
    try {
      const chunks = await db
        .select({ id: documentChunks.id })
        .from(documentChunks)
        .where(eq(documentChunks.tenantId, tenantId));
      const chunkIds = chunks.map((c) => c.id);
      for (let i = 0; i < chunkIds.length; i += 1000) {
        await vectorIndex.delete(chunkIds.slice(i, i + 1000));
      }
    } catch {
      // Best-effort — re-running the job retries the deletion.
    }

    // ── 4. Delete files from S3 / MinIO (original + converted PDF) ─────
    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.tenantId, tenantId));
    const bucket = getEnv("S3_BUCKET_NAME");
    await Promise.allSettled(
      docs.flatMap((doc) => {
        const keys = [`${tenantId}/${doc.storagePath}`];
        const ext = doc.storagePath.split(".").pop()?.toLowerCase();
        if (ext !== "pdf") keys.push(`${tenantId}/${doc.id}.pdf`);
        return keys.map((key) => deleteObject(bucket, key));
      }),
    );

    // ── 5. Database purge + anonymize + final soft delete (atomic) ─────
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId));
    const rawEmail =
      user?.email && !user.email.startsWith("deleted:") ? user.email : null;

    await db.transaction(async (tx) => {
      await tx.delete(chatShares).where(eq(chatShares.tenantId, tenantId));
      await tx
        .delete(turnAlternatives)
        .where(eq(turnAlternatives.tenantId, tenantId));
      await tx
        .delete(conversationTurns)
        .where(eq(conversationTurns.tenantId, tenantId));
      await tx
        .delete(conversations)
        .where(eq(conversations.tenantId, tenantId));
      await tx
        .delete(documentChunks)
        .where(eq(documentChunks.tenantId, tenantId));
      await tx.delete(documents).where(eq(documents.tenantId, tenantId));
      await tx.delete(tenantKeys).where(eq(tenantKeys.tenantId, tenantId));
      await tx.delete(outboxEvents).where(eq(outboxEvents.tenantId, tenantId));

      // Auth telemetry holds the raw email (PII) — remove it.
      if (user?.email) {
        await tx
          .delete(loginAttempts)
          .where(eq(loginAttempts.emailAttempted, user.email));
      }

      // Soft-delete + anonymize. payment_transactions, activity_logs and
      // tenant_subscriptions are intentionally retained for audit.
      await tx
        .update(users)
        .set({
          email: `deleted:${userId}`,
          profilePictureUrl: null,
          deletionStatus: "deleted",
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
      await tx
        .update(tenants)
        .set({
          name: "Deleted Account",
          deletionStatus: "deleted",
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenantId));
    });

    // ── 6. Cache cleanup + refresh tombstone (idempotent) ──────────────
    try {
      await redis.del(
        `tenant_map:${userId}`,
        `welcome_email:${userId}`,
        user?.email ? `unverified_email:${user.email}` : "",
      );
      await redis.set(deletedUserTombstone(userId), "1", {
        ex: DELETED_USER_TOMBSTONE_TTL_SECONDS,
      });
    } catch {
      // Cache cleanup is best-effort.
    }

    // ── 7. Remove the Supabase auth identity (best-effort) ─────────────
    // Safe now: public.users no longer references auth.users, so the audit
    // row survives.
    try {
      await getSupabaseAdmin().auth.admin.deleteUser(userId);
    } catch {
      // The auth user may already be gone — terminal state is already set.
    }

    // ── 8. Send confirmation email (best-effort, idempotent via jobId) ──
    if (rawEmail) {
      try {
        await sendAccountDeletedEmail({
          email: rawEmail,
          jobId,
        });
      } catch {
        // Non-fatal: email failure must not prevent job from completing
      }
    }

    // ── 9. Audit the completion ────────────────────────────────────────
    await logActivity({
      tenantId,
      userId,
      action: "account.deleted",
      resourceType: "account",
      resourceId: jobId,
      metadata: { jobId },
    });
  }

  /**
   * Background sweep (Deno.cron): picks up pending and retryable jobs and
   * runs them one at a time. Failures are persisted on the job row by
   * processJob and never propagate.
   */
  static async sweepPendingJobs(): Promise<void> {
    const jobs = await db
      .select({ id: accountDeletionJobs.id })
      .from(accountDeletionJobs)
      .where(inArray(accountDeletionJobs.status, ["pending", "purging"]));

    for (const job of jobs) {
      await MeService.processJob(job.id);
    }
  }

  /**
   * Updates the password for an authenticated user using their access token.
   * Invalidates all sessions globally after password update.
   */
  static async updatePassword(params: MeParams.UpdatePasswordParams) {
    const supabase = getSupabaseAnon();

    // Validate the provided access token
    const { data, error } = await supabase.auth.getUser(params.accessToken);

    if (error || !data.user) {
      throw new AppError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired session. Please log in again.",
        status: 401,
      });
    }

    const adminSupabase = getSupabaseAdmin();

    // Update the user's password
    try {
      const { error: updateError } =
        await adminSupabase.auth.admin.updateUserById(data.user.id, {
          password: params.newPassword,
        });

      if (updateError) {
        if (params.logContext) {
          params.logContext.authError = updateError.message;
        }
        throw new AppError({
          code: "INTERNAL_ERROR",
          message: "Failed to update password.",
          status: 500,
        });
      }
    } catch (e: any) {
      if (e instanceof AppError) throw e;
      if (params.logContext) {
        params.logContext.authError = e.message;
      }
      throw new AppError({
        code: "INTERNAL_ERROR",
        message: "Failed to update password.",
        status: 500,
      });
    }

    // Force re-login: Invalidate all sessions globally for this user
    try {
      await adminSupabase.auth.admin.signOut(
        params.accessToken,
        "global",
      );
    } catch (signOutErr: any) {
      if (params.logContext) {
        params.logContext.authWarning =
          "Failed to sign out after password update: " +
          signOutErr.message;
      }
    }

    if (params.logContext) {
      params.logContext.authEvent = "update_password_success";
      params.logContext.userId = data.user.id;
    }

    const [userRecord] = await db
      .select({ tenantId: users.tenantId })
      .from(users)
      .where(eq(users.id, data.user.id));
    if (userRecord) {
      await logActivity({
        tenantId: userRecord.tenantId,
        userId: data.user.id,
        action: "auth.password_reset",
        metadata: { type: "update_password" },
      }, params.logContext);
    }
  }

  /**
   * Updates the display name of a tenant workspace.
   */
  static async updateTenantName(params: MeParams.UpdateTenantNameParams) {
    const updated = await withAuthDb(params.userId, async (tx) => {
      const [existing] = await tx
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, params.tenantId));

      if (!existing) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "Tenant not found",
          status: 404,
        });
      }

      const [result] = await tx
        .update(tenants)
        .set({ name: params.name, updatedAt: new Date() })
        .where(eq(tenants.id, params.tenantId))
        .returning({ id: tenants.id, name: tenants.name });

      return result;
    });

    if (params.logContext) {
      params.logContext.authEvent = "tenant_name_updated";
    }

    await logActivity({
      tenantId: params.tenantId,
      userId: params.userId,
      action: "tenant.name_updated",
      metadata: { newName: updated.name },
      ipAddress: params.clientIp,
      userAgent: params.userAgent,
      requestId: params.logContext?.requestId,
    }, params.logContext);

    return {
      tenant: {
        id: updated.id,
        name: updated.name,
      },
      message: "Tenant name updated successfully.",
    };
  }
}
