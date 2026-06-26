import {
    pgTable,
    uuid,
    integer,
    varchar,
    timestamp,
    text,
    boolean,
    jsonb,
    bigint,
    index,
    pgSchema,
    customType,
} from "drizzle-orm/pg-core";

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
    createdAt: timestamp("created_at", { mode: "date", precision: 3, withTimezone: true }).defaultNow(),
});

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
    lockedUntil: timestamp("locked_until", { mode: "date", precision: 3, withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", precision: 3, withTimezone: true }).defaultNow(),
});

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
            cache: 1
        }),
        emailAttempted: varchar("email_attempted", { length: 255 }).notNull(),
        ipAddress: inet("ip_address").notNull(),
        userAgent: text("user_agent"),
        isSuccess: boolean("is_success").default(false),
        authProvider: varchar("auth_provider", { length: 50 }).default("email"),
        attemptedAt: timestamp("attempted_at", { mode: "date", precision: 3, withTimezone: true }).defaultNow(),
    },
    (table) => ({
        emailIpIdx: index("idx_login_attempts_email_ip").on(
            table.emailAttempted,
            table.ipAddress,
            table.attemptedAt
        ),
    })
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
    status: varchar("status", { length: 50 }).default("pending").notNull(),
    createdAt: timestamp("created_at", { mode: "date", precision: 3, withTimezone: true }).defaultNow().notNull(),
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
    content: text("content").notNull(),
    fts: tsvector("fts"),
});

// ==============================================================================
// 6. CONVERSATIONS TABLE
// ==============================================================================
export const conversations = pgTable("conversations", {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
        .notNull()
        .references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { mode: "date", precision: 3, withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3, withTimezone: true })
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
    createdAt: timestamp("created_at", { mode: "date", precision: 3, withTimezone: true }).defaultNow().notNull(),
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
    createdAt: timestamp("created_at", { mode: "date", precision: 3, withTimezone: true }).defaultNow().notNull(),
});
