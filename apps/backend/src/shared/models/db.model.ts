import {
    bigint,
    boolean,
    customType,
    index,
    integer,
    jsonb,
    pgEnum,
    pgSchema,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Define the custom inet type for Drizzle to support IP addresses natively
const inet = customType<{ data: string }>({
    dataType() {
        return "inet";
    },
});

// Define custom tsvector type for Full-Text Search
const tsvector = customType<{ data: string }>({
    dataType() {
        return "tsvector";
    },
});

// Reference Supabase's auth.users table
const authSchema = pgSchema("auth");
export const authUsers = authSchema.table("users", {
    id: uuid("id").primaryKey(),
});

// ==============================================================================
// ACCOUNT LIFECYCLE ENUMS
// ==============================================================================
// Tracks the account deletion lifecycle on users and tenants. 'active' is the
// default; 'deletion_pending' blocks all access while the async purge runs;
// 'deleted' is terminal — the row is kept (soft delete) for audit purposes but
// is never reactivated and never reused by a new registration.
export const deletionStatusEnum = pgEnum("deletion_status_enum", [
    "active",
    "deletion_pending",
    "deleted",
]);

// State machine of the async purge job that executes account deletion.
export const accountDeletionJobStatusEnum = pgEnum(
    "account_deletion_job_status_enum",
    ["pending", "purging", "completed", "failed"],
);

// ==============================================================================
// 1. TENANTS TABLE (1 User = 1 Tenant)
// ==============================================================================
export const tenants = pgTable("tenants", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    // Account lifecycle. 'deletion_pending' blocks all access while the async
    // purge runs; 'deleted' is terminal. Soft-deleted tenants are never reused.
    deletionStatus: deletionStatusEnum("deletion_status").notNull().default("active"),
    deletedAt: timestamp("deleted_at", {
        mode: "date",
        precision: 3,
        withTimezone: true,
    }),
    createdAt: timestamp("created_at", {
        mode: "date",
        precision: 3,
        withTimezone: true,
    }).defaultNow(),
    updatedAt: timestamp("updated_at", {
        mode: "date",
        precision: 3,
        withTimezone: true,
    }).defaultNow(),
});

// ==============================================================================
// 1.5. TENANT KEYS TABLE (BYOK Cryptography)
// ==============================================================================
export const tenantKeys = pgTable("tenant_keys", {
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 50 }).notNull().default("gemini"),
    encryptedApiKey: text("encrypted_api_key").notNull(),
    iv: varchar("iv", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", precision: 3, withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3, withTimezone: true }).defaultNow().$onUpdateFn(() => new Date()),
}, (table) => ({
    pk: primaryKey({ columns: [table.tenantId, table.provider] }),
}));

// ==============================================================================
// 2. USERS TABLE
// ==============================================================================
// `id` is intentionally NOT a foreign key to auth.users anymore: when the
// Supabase auth user is deleted (account deletion), this row survives in a
// soft-deleted state for audit purposes. New registrations create a fresh
// auth user AND a fresh public.users row — old rows are never reactivated.
export const users = pgTable("users", {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
        .notNull()
        .references(() => tenants.id, { onDelete: "restrict" }),
    email: varchar("email", { length: 255 }).notNull(),
    profilePictureUrl: text("profile_picture_url"),
    isLocked: boolean("is_locked").default(false),
    lockedUntil: timestamp("locked_until", {
        mode: "date",
        precision: 3,
        withTimezone: true,
    }),
    deletionStatus: deletionStatusEnum("deletion_status")
        .notNull()
        .default("active"),
    deletedAt: timestamp("deleted_at", {
        mode: "date",
        precision: 3,
        withTimezone: true,
    }),
    createdAt: timestamp("created_at", {
        mode: "date",
        precision: 3,
        withTimezone: true,
    }).defaultNow(),
    updatedAt: timestamp("updated_at", {
        mode: "date",
        precision: 3,
        withTimezone: true,
    }).defaultNow(),
}, (table) => ({
    // Emails are only unique among ACTIVE accounts. Soft-deleted rows keep a
    // row (with an anonymized email) without blocking re-registration of the
    // same email address.
    activeEmailIdx: uniqueIndex("idx_users_active_email")
        .on(table.email)
        .where(sql`deleted_at is null`),
}));

// ==============================================================================
// ENUMS
// ==============================================================================
export const documentStatusEnum = pgEnum("document_status_enum", [
    "pending",
    "confirmed",
    "processed",
    "quota_exhausted",
    "failed",
    "failed_vectorizing",
]);

export const authProviderEnum = pgEnum("auth_provider_enum", [
    "email",
    "forget_password",
    "register",
    "oauth_google",
    "oauth_github",
]);

export const turnStatusEnum = pgEnum("turn_status_enum", [
    "processing",
    "awaiting_indexing",
    "complete",
    "stopped",
    "failed",
    "blocked",
]);

export const feedbackEnum = pgEnum("feedback_enum", ["good", "bad"]);

// ==============================================================================
// 3. LOGIN ATTEMPTS TABLE (Anti-Bruteforce)
// ==============================================================================
export const loginAttempts = pgTable(
    "login_attempts",
    {
        id: integer("id").primaryKey().generatedAlwaysAsIdentity({
            startWith: 1000,
            increment: 1,
            minValue: 1,
            maxValue: 2147483647,
            cache: 1,
        }),
        emailAttempted: varchar("email_attempted", { length: 255 }).notNull(),
        ipAddress: inet("ip_address").notNull(),
        userAgent: text("user_agent"),
        deviceBrand: varchar("device_brand", { length: 100 }),
        deviceModel: varchar("device_model", { length: 200 }),
        isSuccess: boolean("is_success").default(false),
        authProvider: authProviderEnum("auth_provider").default("email"),
        attemptedAt: timestamp("attempted_at", {
            mode: "date",
            precision: 3,
            withTimezone: true,
        }).defaultNow(),
    },
    (table) => ({
        emailIpIdx: index("idx_login_attempts_email_ip").on(
            table.emailAttempted,
            table.ipAddress,
            table.attemptedAt,
        ),
    }),
);

// ==============================================================================
// 4. DOCUMENTS TABLE
// ==============================================================================
export const documents = pgTable("documents", {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
        .notNull()
        .references(() => tenants.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    storagePath: text("storage_path").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    description: text("description"),
    status: documentStatusEnum("status").default("pending").notNull(),
    createdAt: timestamp("created_at", {
        mode: "date",
        precision: 3,
        withTimezone: true,
    })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp("updated_at", {
        mode: "date",
        precision: 3,
        withTimezone: true,
    })
        .defaultNow()
        .notNull(),
});

// ==============================================================================
// 5. DOCUMENT CHUNKS TABLE (FTS & Lazy Hydration)
// ==============================================================================
export const documentChunks = pgTable("document_chunks", {
    id: uuid("id").primaryKey(), // ID strictly matches Upstash Vector ID
    tenantId: uuid("tenant_id")
        .notNull()
        .references(() => tenants.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
        .notNull()
        .references(() => documents.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    metadata: jsonb("metadata"),
    content: text("content").notNull(),
    fts: tsvector("fts").generatedAlwaysAs(sql`to_tsvector('indonesian', content) || to_tsvector('english', content)`),
}, (table) => ({
    tenantIdx: index("idx_document_chunks_tenant").on(table.tenantId),
    ftsIdx: index("idx_document_chunks_fts").using("gin", table.fts),
}));

// ==============================================================================
// 6. CONVERSATIONS TABLE
// ==============================================================================
export const conversations = pgTable("conversations", {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
        .notNull()
        .references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    isPinned: boolean("is_pinned").default(false).notNull(),
    // Non-null when this conversation was branched from another (the parent).
    // ON DELETE SET NULL: the branch keeps existing if the parent is deleted,
    // it just loses the lineage link.
    branchOfId: uuid("branch_of_id").references(
        () => conversations.id,
        { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", {
        mode: "date",
        precision: 3,
        withTimezone: true,
    })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp("updated_at", {
        mode: "date",
        precision: 3,
        withTimezone: true,
    })
        .defaultNow()
        .notNull()
        .$onUpdateFn(() => new Date()),
});

// ==============================================================================
// 7. CONVERSATION TURNS TABLE (RAG History & Observability)
// ==============================================================================
export const conversationTurns = pgTable("conversation_turns", {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
        .notNull()
        .references(() => tenants.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
        .notNull()
        .references(() => conversations.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    // Nullable: no model is recorded when the request was blocked (prompt
    // injection) or cancelled before any model was selected.
    modelUsed: varchar("model_used", { length: 100 }),
    latencyMs: integer("latency_ms"),
    contextReferences: jsonb("context_references"),
    status: turnStatusEnum("status").notNull().default("complete"),
    // User feedback on the answer (good/bad). Nullable: no rating given yet.
    // Cleared when the turn is edited/regenerated — the old rating would be stale.
    feedback: feedbackEnum("feedback"),
    feedbackAt: timestamp("feedback_at", {
        mode: "date",
        precision: 3,
        withTimezone: true,
    }),
    // Set ONLY on the boundary turn of a branched conversation — points to the
    // original turn in the parent conversation that this copy was made from.
    // Plain column (NO FK): the marker must survive the parent turn/conversation
    // being deleted, so the frontend can still render "Branched from Deleted
    // Conversation". It is a lineage pointer, not referential integrity.
    branchedFromTurnId: uuid("branched_from_turn_id"),
    // Set on turns that carry chat attachments: the document ids that scope
    // RAG retrieval. Persisted so the background sweep (awaiting_indexing) and
    // later edit/retry of the turn can reuse the same scoping. Nullable.
    attachmentDocumentIds: jsonb("attachment_document_ids"),
    // BYOK choice ({ provider, model }) for awaiting turns — the background
    // sweep completes them without the client present. Null = system mode.
    modelRequest: jsonb("model_request"),
    updatedAt: timestamp("updated_at", {
        mode: "date",
        precision: 3,
        withTimezone: true,
    })
        .defaultNow()
        .notNull()
        .$onUpdateFn(() => new Date()),
    createdAt: timestamp("created_at", {
        mode: "date",
        precision: 3,
        withTimezone: true,
    })
        .defaultNow()
        .notNull(),
});

// ==============================================================================
// 7.5. TURN ALTERNATIVES TABLE (Retry Variants)
// ==============================================================================
// One row per retried answer for a turn (1:N to conversation_turns). Only the
// latest turn of a conversation can receive retries; unselected variants are
// deleted when a follow-up turn completes successfully.
export const turnAlternatives = pgTable("turn_alternatives", {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
        .notNull()
        .references(() => tenants.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
        .notNull()
        .references(() => conversations.id, { onDelete: "cascade" }),
    turnId: uuid("turn_id")
        .notNull()
        .references(() => conversationTurns.id, { onDelete: "cascade" }),
    answer: text("answer").notNull(),
    // Nullable: no model is recorded when the retry was cancelled before any
    // model was selected (mirrors conversationTurns.modelUsed).
    modelUsed: varchar("model_used", { length: 100 }),
    latencyMs: integer("latency_ms"),
    contextReferences: jsonb("context_references"),
    status: turnStatusEnum("status").notNull().default("complete"),
    updatedAt: timestamp("updated_at", {
        mode: "date",
        precision: 3,
        withTimezone: true,
    })
        .defaultNow()
        .notNull()
        .$onUpdateFn(() => new Date()),
    createdAt: timestamp("created_at", {
        mode: "date",
        precision: 3,
        withTimezone: true,
    })
        .defaultNow()
        .notNull(),
}, (table) => ({
    turnIdx: index("idx_turn_alternatives_turn").on(table.turnId),
}));

// ==============================================================================
// 7.6. CHAT SHARES TABLE (Public Read-Only Share Links)
// ==============================================================================
// One row per public share link. The `snapshot` column is an immutable copy of
// the conversation turns (question/answer/references/model/status/timestamps)
// taken at share time — later edits or new turns never leak into the public
// view. `conversation_id` is kept for the authenticated "continue this chat"
// flow, which rebuilds a conversation from the snapshot.
export const chatShares = pgTable("chat_shares", {
    code: varchar("code", { length: 32 }).primaryKey(),
    tenantId: uuid("tenant_id")
        .notNull()
        .references(() => tenants.id, { onDelete: "cascade" }),
    // Nullable: survives the sharer's account being deleted.
    createdBy: uuid("created_by").references(() => users.id, {
        onDelete: "set null",
    }),
    // Cascade: deleting the conversation revokes its public shares.
    conversationId: uuid("conversation_id")
        .notNull()
        .references(() => conversations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    // Immutable copy of the shared turns at share time.
    snapshot: jsonb("snapshot").notNull(),
    isCustom: boolean("is_custom").default(false).notNull(),
    // True once at least one email invitee exists: the link is then gated
    // behind `accessToken` (see share_invitees).
    isPrivate: boolean("is_private").default(false).notNull(),
    // View credential for private shares — embedded in invite links as
    // `?invite=`. Never exposed to anon DB role or in public responses.
    accessToken: varchar("access_token", { length: 64 }),
    // Nullable: NULL means the link never expires.
    expiresAt: timestamp("expires_at", {
        mode: "date",
        precision: 3,
        withTimezone: true,
    }),
    createdAt: timestamp("created_at", {
        mode: "date",
        precision: 3,
        withTimezone: true,
    })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp("updated_at", {
        mode: "date",
        precision: 3,
        withTimezone: true,
    })
        .defaultNow()
        .notNull()
        .$onUpdateFn(() => new Date()),
}, (table) => ({
    tenantIdx: index("idx_chat_shares_tenant").on(table.tenantId),
    conversationIdx: index("idx_chat_shares_conversation").on(
        table.conversationId,
    ),
}));

// ==============================================================================
// 7.7. SHARE INVITEES TABLE (Private Share Access List)
// ==============================================================================
// One row per invited email for a share. A share with at least one invitee is
// private: reading it requires the share's `access_token` (sent to invitees by
// email). `notified_at` records when the invite email was actually delivered.
export const shareInvitees = pgTable("share_invitees", {
    code: varchar("code", { length: 32 })
        .notNull()
        .references(() => chatShares.code, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    notifiedAt: timestamp("notified_at", {
        mode: "date",
        precision: 3,
        withTimezone: true,
    }),
    createdAt: timestamp("created_at", {
        mode: "date",
        precision: 3,
        withTimezone: true,
    })
        .defaultNow()
        .notNull(),
}, (table) => ({
    pk: primaryKey({ columns: [table.code, table.email] }),
    emailIdx: index("idx_share_invitees_email").on(table.email),
}));

// ==============================================================================
// 8. OUTBOX EVENTS TABLE (Transactional Outbox)
// ==============================================================================
export const outboxEvents = pgTable("outbox_events", {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
        .notNull()
        .references(() => tenants.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 255 }).notNull(),
    payload: jsonb("payload").notNull(),
    status: varchar("status", { length: 50 }).default("pending").notNull(),
    createdAt: timestamp("created_at", {
        mode: "date",
        precision: 3,
        withTimezone: true,
    })
        .defaultNow()
        .notNull(),
});

// ==============================================================================
// 9. TENANT SUBSCRIPTIONS (1:1 relation with tenants)
// ==============================================================================
export const tierEnum = pgEnum("tier_enum", ["FREE", "SIMULATE", "OIL_INVESTOR", "PRO"]);

export const tenantSubscriptions = pgTable("tenant_subscriptions", {
    tenantId: uuid("tenant_id").primaryKey().references(() => tenants.id, { onDelete: "cascade" }),
    tier: tierEnum("tier").notNull().default("FREE"), // FREE, SIMULATE, INVESTOR, REAL
    
    uploadsCount: integer("uploads_count").notNull().default(0),
    searchesCount: integer("searches_count").notNull().default(0),
    qaCount: integer("qa_count").notNull().default(0),
    
    storageUsedBytes: bigint("storage_used_bytes", { mode: "number" }).notNull().default(0),
    
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }).unique(),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }).unique(),
    
    expiresAt: timestamp("expires_at", { mode: "date", precision: 3, withTimezone: true }), 
    lastResetAt: timestamp("last_reset_at", { mode: "date", precision: 3, withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3, withTimezone: true }).defaultNow(),
});

// ==============================================================================
// 10. PAYMENT TRANSACTIONS (Stripe Checkout API)
// ==============================================================================
export const paymentStatusEnum = pgEnum("payment_status_enum", [
    "PENDING",
    "SUCCEEDED",
    "FAILED",
    "CANCELED",
    "EXPIRED"
]);

export const paymentTransactions = pgTable(
    "payment_transactions",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
        
        externalId: varchar("external_id", { length: 255 }).notNull().unique(), // Our internal reference
        stripeSessionId: varchar("stripe_session_id", { length: 255 }), // Checkout Session ID
        stripeCustomerId: varchar("stripe_customer_id", { length: 255 }), 
        
        tierToUnlock: tierEnum("tier_to_unlock").notNull(),
        amount: integer("amount").notNull(),
        currency: varchar("currency", { length: 3 }).notNull().default("USD"),
        
        status: paymentStatusEnum("status").notNull().default("PENDING"),
        
        webhookPayload: jsonb("webhook_payload"),
        
        paidAt: timestamp("paid_at", { mode: "date", precision: 3, withTimezone: true }),
        createdAt: timestamp("created_at", { mode: "date", precision: 3, withTimezone: true }).defaultNow(),
        updatedAt: timestamp("updated_at", { mode: "date", precision: 3, withTimezone: true }).defaultNow(),
    },
    (table) => ({
        tenantStatusIdx: index("idx_payment_trx_tenant_status").on(table.tenantId, table.status),
        externalIdIdx: index("idx_payment_trx_external_id").on(table.externalId),
        stripeSessionIdx: index("idx_payment_trx_stripe_session").on(table.stripeSessionId),
    })
);
// ==============================================================================
// 11. ACTIVITY LOGS (Audit Trail)
// ==============================================================================
export const activityActionEnum = pgEnum("activity_action_enum", [
    // Auth
    "auth.login",
    "auth.logout",
    "auth.register",
    "auth.password_reset",
    // Documents
    "document.uploaded",
    "document.deleted",
    "document.processed",
    "document.failed",
    "document.quota_exhausted",
    "document.renamed",
    // Search & RAG
    "search.performed",
    "chat.started",
    // Billing
    "billing.checkout_initiated",
    "billing.payment_completed",
    "billing.payment_failed",
    // Tenant
    "tenant.name_updated",
    // Account deletion
    "account.deletion_requested",
    "account.deleted",
]);

export const activityLogs = pgTable("activity_logs", {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: activityActionEnum("action").notNull(),
    resourceType: varchar("resource_type", { length: 100 }), // e.g. "document", "payment"
    resourceId: varchar("resource_id", { length: 255 }), // using varchar to support external IDs too
    metadata: jsonb("metadata"),
    ipAddress: inet("ip_address"),
    userAgent: text("user_agent"),
    operatingSystem: varchar("operating_system", { length: 100 }),
    deviceType: varchar("device_type", { length: 32 }),
    location: varchar("location", { length: 100 }),
    requestId: varchar("request_id", { length: 36 }),
    createdAt: timestamp("created_at", { mode: "date", precision: 3, withTimezone: true }).defaultNow(),
}, (table) => ({
    tenantCreatedIdx: index("idx_activity_tenant_created").on(table.tenantId, table.createdAt.desc()),
    tenantActionCreatedIdx: index("idx_activity_tenant_action_created").on(table.tenantId, table.action, table.createdAt.desc()),
    userCreatedIdx: index("idx_activity_user_created").on(table.userId, table.createdAt.desc()),
}));

// ==============================================================================
// 12. ACCOUNT DELETION JOBS (Async Purge State Machine)
// ==============================================================================
// One row per requested account deletion. The endpoint marks the user/tenant
// as 'deletion_pending' and enqueues a job; a background sweep (Deno.cron)
// executes the purge in idempotent steps with retry, so a crash or a failing
// external service (S3, Vector, Stripe, Supabase) never leaves the account in
// a half-deleted state.
export const accountDeletionJobs = pgTable(
    "account_deletion_jobs",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        tenantId: uuid("tenant_id")
            .notNull()
            .references(() => tenants.id, { onDelete: "cascade" }),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        status: accountDeletionJobStatusEnum("status")
            .notNull()
            .default("pending"),
        attemptCount: integer("attempt_count").notNull().default(0),
        lastError: text("last_error"),
        completedAt: timestamp("completed_at", {
            mode: "date",
            precision: 3,
            withTimezone: true,
        }),
        createdAt: timestamp("created_at", {
            mode: "date",
            precision: 3,
            withTimezone: true,
        })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", {
            mode: "date",
            precision: 3,
            withTimezone: true,
        })
            .defaultNow()
            .notNull()
            .$onUpdateFn(() => new Date()),
    },
    (table) => ({
        statusIdx: index("idx_account_deletion_jobs_status").on(table.status),
        tenantIdx: index("idx_account_deletion_jobs_tenant").on(table.tenantId),
    }),
);
