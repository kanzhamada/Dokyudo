import {
    pgTable,
    uuid,
    integer,
    varchar,
    timestamp,
    text,
    boolean,
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
