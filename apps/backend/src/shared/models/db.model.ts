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
// 1. TENANTS TABLE (1 User = 1 Tenant)
// ==============================================================================
export const tenants = pgTable("tenants", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
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
export const users = pgTable("users", {
    id: uuid("id")
        .primaryKey()
        .references(() => authUsers.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
        .notNull()
        .references(() => tenants.id, { onDelete: "restrict" }),
    email: varchar("email", { length: 255 }).notNull().unique(),
    profilePictureUrl: text("profile_picture_url"),
    isLocked: boolean("is_locked").default(false),
    lockedUntil: timestamp("locked_until", {
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
    modelUsed: varchar("model_used", { length: 100 }).notNull(),
    latencyMs: integer("latency_ms"),
    contextReferences: jsonb("context_references"),
    createdAt: timestamp("created_at", {
        mode: "date",
        precision: 3,
        withTimezone: true,
    })
        .defaultNow()
        .notNull(),
});

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
    // Search & RAG
    "search.performed",
    "chat.started",
    // Billing
    "billing.checkout_initiated",
    "billing.payment_completed",
    "billing.payment_failed",
    // Tenant
    "tenant.name_updated",
]);

export const activityLogs = pgTable("activity_logs", {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: activityActionEnum("action").notNull(),
    resourceType: varchar("resource_type", { length: 100 }), // e.g. "document", "payment"
    resourceId: varchar("resource_id", { length: 255 }), // using varchar to support external IDs too
    metadata: jsonb("metadata"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    requestId: varchar("request_id", { length: 36 }),
    createdAt: timestamp("created_at", { mode: "date", precision: 3, withTimezone: true }).defaultNow(),
}, (table) => ({
    tenantCreatedIdx: index("idx_activity_tenant_created").on(table.tenantId, table.createdAt.desc()),
    userCreatedIdx: index("idx_activity_user_created").on(table.userId, table.createdAt.desc()),
}));
