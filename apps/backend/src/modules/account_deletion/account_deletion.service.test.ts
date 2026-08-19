import { describe, it, beforeEach, afterAll } from "jsr:@std/testing/bdd";
import { assertEquals, assertRejects, assertExists } from "jsr:@std/assert";
import { stub } from "jsr:@std/testing/mock";
import { db } from "../../config/drizzle.ts";
import { AccountDeletionService } from "./account_deletion.service.ts";
import { AppError } from "../../shared/utils/errors.util.ts";
import { stripe } from "../../config/stripe.ts";
import {
    accountDeletionJobs,
    activityLogs,
    chatShares,
    conversationTurns,
    conversations,
    documentChunks,
    documents,
    paymentTransactions,
    tenantKeys,
    tenantSubscriptions,
    tenants,
    users,
} from "../../shared/models/db.model.ts";
import { eq } from "drizzle-orm";

describe("AccountDeletionService", () => {
    let testUserId: string;
    let testTenantId: string;
    let testEmail: string;

    beforeEach(async () => {
        testUserId = crypto.randomUUID();
        testTenantId = crypto.randomUUID();
        testEmail = `deletion-test-${crypto.randomUUID()}@example.com`;
    });

    const cleanup = async () => {
        await db.delete(accountDeletionJobs).where(eq(accountDeletionJobs.userId, testUserId));
        await db.delete(activityLogs).where(eq(activityLogs.tenantId, testTenantId));
        await db.delete(paymentTransactions).where(eq(paymentTransactions.tenantId, testTenantId));
        await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, testTenantId));
        await db.delete(users).where(eq(users.id, testUserId));
        await db.delete(tenants).where(eq(tenants.id, testTenantId));
    };

    describe("requestAccountDeletion", () => {
        it("creates a pending job and flips user+tenant to deletion_pending", async () => {
            await db.insert(tenants).values({ id: testTenantId, name: "Delete Request Tenant" });
            await db.insert(users).values({ id: testUserId, tenantId: testTenantId, email: testEmail });
            await db.insert(tenantSubscriptions).values({ tenantId: testTenantId, tier: "FREE" });

            try {
                const result = await AccountDeletionService.requestAccountDeletion({
                    userId: testUserId,
                    tenantId: testTenantId,
                    clientIp: "127.0.0.1",
                });

                assertExists(result.jobId);

                const [job] = await db.select().from(accountDeletionJobs).where(eq(accountDeletionJobs.id, result.jobId));
                assertEquals(job.status, "pending");
                assertEquals(job.userId, testUserId);

                const [user] = await db.select().from(users).where(eq(users.id, testUserId));
                assertEquals(user.deletionStatus, "deletion_pending");
                const [tenant] = await db.select().from(tenants).where(eq(tenants.id, testTenantId));
                assertEquals(tenant.deletionStatus, "deletion_pending");
            } finally {
                await cleanup();
            }
        });

        it("is idempotent — a second request returns the same job", async () => {
            await db.insert(tenants).values({ id: testTenantId, name: "Delete Request Tenant" });
            await db.insert(users).values({ id: testUserId, tenantId: testTenantId, email: testEmail });
            await db.insert(tenantSubscriptions).values({ tenantId: testTenantId, tier: "FREE" });

            try {
                const first = await AccountDeletionService.requestAccountDeletion({
                    userId: testUserId,
                    tenantId: testTenantId,
                });
                const second = await AccountDeletionService.requestAccountDeletion({
                    userId: testUserId,
                    tenantId: testTenantId,
                });
                assertEquals(second.jobId, first.jobId);
            } finally {
                await cleanup();
            }
        });

        it("rejects an account that is already deleted", async () => {
            await db.insert(tenants).values({
                id: testTenantId,
                name: "Old Tenant",
                deletionStatus: "deleted",
                deletedAt: new Date(),
            });
            await db.insert(users).values({
                id: testUserId,
                tenantId: testTenantId,
                email: testEmail,
                deletionStatus: "deleted",
                deletedAt: new Date(),
            });

            try {
                await assertRejects(
                    () => AccountDeletionService.requestAccountDeletion({
                        userId: testUserId,
                        tenantId: testTenantId,
                    }),
                    AppError,
                    "Account not found",
                );
            } finally {
                await cleanup();
            }
        });

        it("rejects a non-existent account", async () => {
            await assertRejects(
                () => AccountDeletionService.requestAccountDeletion({
                    userId: testUserId,
                    tenantId: testTenantId,
                }),
                AppError,
                "Account not found",
            );
        });
    });

    describe("processJob (async purge)", () => {
        it("purges operational data, anonymizes, and retains payment + activity history", async () => {
            await db.insert(tenants).values({ id: testTenantId, name: "Purge Tenant" });
            await db.insert(users).values({ id: testUserId, tenantId: testTenantId, email: testEmail });
            await db.insert(tenantSubscriptions).values({ tenantId: testTenantId, tier: "FREE" });

            // Operational data that must be wiped.
            const docId = crypto.randomUUID();
            const convId = crypto.randomUUID();
            const turnId = crypto.randomUUID();
            const chunkId = crypto.randomUUID();
            const shareCode = crypto.randomUUID().slice(0, 32);

            await db.insert(documents).values({
                id: docId,
                tenantId: testTenantId,
                title: "Secret.pdf",
                storagePath: "secret.pdf",
                sizeBytes: 100,
                status: "processed",
            });
            await db.insert(documentChunks).values({
                id: chunkId,
                tenantId: testTenantId,
                documentId: docId,
                chunkIndex: 0,
                content: "secret content",
            });
            await db.insert(conversations).values({ id: convId, tenantId: testTenantId, title: "Secret Chat" });
            await db.insert(conversationTurns).values({
                id: turnId,
                tenantId: testTenantId,
                conversationId: convId,
                question: "q",
                answer: "a",
            });
            await db.insert(chatShares).values({
                code: shareCode,
                tenantId: testTenantId,
                conversationId: convId,
                title: "Secret Share",
                snapshot: {},
            });
            await db.insert(tenantKeys).values({
                tenantId: testTenantId,
                provider: "gemini",
                encryptedApiKey: "enc",
                iv: "iv",
            });

            // History that must survive.
            await db.insert(paymentTransactions).values({
                tenantId: testTenantId,
                externalId: `dokyudo-${testTenantId}-keep`,
                tierToUnlock: "PRO",
                amount: 1000,
                currency: "USD",
                status: "SUCCEEDED",
            });
            await db.insert(activityLogs).values({
                tenantId: testTenantId,
                userId: testUserId,
                action: "auth.login",
                metadata: { provider: "email" },
            });

            const [job] = await db.insert(accountDeletionJobs)
                .values({ tenantId: testTenantId, userId: testUserId })
                .returning({ id: accountDeletionJobs.id });

            try {
                await AccountDeletionService.processJob(job.id);

                // 1. Operational data purged.
                assertEquals((await db.select().from(documents).where(eq(documents.id, docId))).length, 0);
                assertEquals((await db.select().from(documentChunks).where(eq(documentChunks.id, chunkId))).length, 0);
                assertEquals((await db.select().from(conversations).where(eq(conversations.id, convId))).length, 0);
                assertEquals((await db.select().from(conversationTurns).where(eq(conversationTurns.id, turnId))).length, 0);
                assertEquals((await db.select().from(chatShares).where(eq(chatShares.code, shareCode))).length, 0);
                assertEquals((await db.select().from(tenantKeys).where(eq(tenantKeys.tenantId, testTenantId))).length, 0);

                // 2. History retained.
                const [payments] = await db.select().from(paymentTransactions).where(eq(paymentTransactions.tenantId, testTenantId));
                assertExists(payments);
                const [logs] = await db.select().from(activityLogs).where(eq(activityLogs.tenantId, testTenantId));
                assertExists(logs);
                const [sub] = await db.select().from(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, testTenantId));
                assertExists(sub);

                // 3. Soft-deleted + anonymized.
                const [user] = await db.select().from(users).where(eq(users.id, testUserId));
                assertEquals(user.deletionStatus, "deleted");
                assertEquals(user.email, `deleted:${testUserId}`);
                const [tenant] = await db.select().from(tenants).where(eq(tenants.id, testTenantId));
                assertEquals(tenant.deletionStatus, "deleted");
                assertEquals(tenant.name, "Deleted Account");

                // 4. Job completed.
                const [completedJob] = await db.select().from(accountDeletionJobs).where(eq(accountDeletionJobs.id, job.id));
                assertEquals(completedJob.status, "completed");
                assertExists(completedJob.completedAt);
            } finally {
                await cleanup();
            }
        });

        it("allows re-registration with the same email after the old account is purged", async () => {
            await db.insert(tenants).values({ id: testTenantId, name: "Old Tenant" });
            await db.insert(users).values({ id: testUserId, tenantId: testTenantId, email: testEmail });
            await db.insert(tenantSubscriptions).values({ tenantId: testTenantId, tier: "FREE" });

            const [job] = await db.insert(accountDeletionJobs)
                .values({ tenantId: testTenantId, userId: testUserId })
                .returning({ id: accountDeletionJobs.id });

            const newTenantId = crypto.randomUUID();
            const newUserId = crypto.randomUUID();

            try {
                await AccountDeletionService.processJob(job.id);

                // A brand-new account can claim the same email.
                await db.insert(tenants).values({ id: newTenantId, name: "New Tenant" });
                await db.insert(users).values({ id: newUserId, tenantId: newTenantId, email: testEmail });

                const [newUser] = await db.select().from(users).where(eq(users.id, newUserId));
                assertEquals(newUser.deletionStatus, "active");
                assertEquals(newUser.email, testEmail);
            } finally {
                await cleanup();
                await db.delete(users).where(eq(users.id, newUserId));
                await db.delete(tenants).where(eq(tenants.id, newTenantId));
            }
        });

        it("is idempotent — re-running a completed job is a no-op", async () => {
            await db.insert(tenants).values({ id: testTenantId, name: "Idempotent Tenant" });
            await db.insert(users).values({ id: testUserId, tenantId: testTenantId, email: testEmail });
            await db.insert(tenantSubscriptions).values({ tenantId: testTenantId, tier: "FREE" });

            const [job] = await db.insert(accountDeletionJobs)
                .values({ tenantId: testTenantId, userId: testUserId })
                .returning({ id: accountDeletionJobs.id });

            try {
                await AccountDeletionService.processJob(job.id);
                await AccountDeletionService.processJob(job.id);

                const [jobAfter] = await db.select().from(accountDeletionJobs).where(eq(accountDeletionJobs.id, job.id));
                assertEquals(jobAfter.status, "completed");
                assertEquals(jobAfter.attemptCount, 1);
            } finally {
                await cleanup();
            }
        });
    });

    describe("isUserActive (login / OAuth guard)", () => {
        it("returns true only for an active account", async () => {
            await db.insert(tenants).values({ id: testTenantId, name: "Active Tenant" });
            await db.insert(users).values({ id: testUserId, tenantId: testTenantId, email: testEmail });

            try {
                assertEquals(await AccountDeletionService.isUserActive(testUserId), true);
            } finally {
                await cleanup();
            }
        });

        it("returns false for a deletion_pending account", async () => {
            await db.insert(tenants).values({
                id: testTenantId,
                name: "Pending Tenant",
                deletionStatus: "deletion_pending",
            });
            await db.insert(users).values({
                id: testUserId,
                tenantId: testTenantId,
                email: testEmail,
                deletionStatus: "deletion_pending",
            });

            try {
                assertEquals(await AccountDeletionService.isUserActive(testUserId), false);
            } finally {
                await cleanup();
            }
        });

        it("returns false for a deleted account", async () => {
            await db.insert(tenants).values({
                id: testTenantId,
                name: "Deleted Tenant",
                deletionStatus: "deleted",
                deletedAt: new Date(),
            });
            await db.insert(users).values({
                id: testUserId,
                tenantId: testTenantId,
                email: testEmail,
                deletionStatus: "deleted",
                deletedAt: new Date(),
            });

            try {
                assertEquals(await AccountDeletionService.isUserActive(testUserId), false);
            } finally {
                await cleanup();
            }
        });

        it("returns false for a non-existent user", async () => {
            assertEquals(
                await AccountDeletionService.isUserActive(crypto.randomUUID()),
                false,
            );
        });
    });

    describe("purge billing cleanup (checkout+delete race)", () => {
        it("cancels ALL active subscriptions for the customer, not just the stored id", async () => {
            await db.insert(tenants).values({ id: testTenantId, name: "Race Tenant" });
            await db.insert(users).values({ id: testUserId, tenantId: testTenantId, email: testEmail });
            await db.insert(tenantSubscriptions).values({
                tenantId: testTenantId,
                tier: "PRO",
                stripeCustomerId: "cus_test_race",
                stripeSubscriptionId: "sub_stored",
            });

            // The orphan: created by a checkout completed AFTER the deletion
            // request, whose id was never stored (provisioning was skipped).
            const fakeListSubscriptions = async (): Promise<any> => ({
                data: [
                    { id: "sub_orphan", status: "active" },
                    { id: "sub_stored", status: "active" },
                    { id: "sub_already_canceled", status: "canceled" },
                ],
            });
            using listStub = stub(
                stripe.subscriptions,
                "list",
                fakeListSubscriptions as any,
            );
            using cancelStub = stub(stripe.subscriptions, "cancel", () =>
                Promise.resolve({ id: "sub" } as any),
            );

            const [job] = await db.insert(accountDeletionJobs)
                .values({ tenantId: testTenantId, userId: testUserId })
                .returning({ id: accountDeletionJobs.id });

            try {
                await AccountDeletionService.processJob(job.id);

                const cancelledIds = cancelStub.calls.map((call) => call.args[0] as string);
                // Stored subscription canceled (direct path).
                assertEquals(cancelledIds.includes("sub_stored"), true);
                // Orphan from the race canceled (customer sweep path).
                assertEquals(cancelledIds.includes("sub_orphan"), true);
                // Already-canceled subscriptions are left alone.
                assertEquals(cancelledIds.includes("sub_already_canceled"), false);
            } finally {
                await cleanup();
            }
        });
    });
});