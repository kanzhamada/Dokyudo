-- =============================================================================
-- 0029: Account deletion lifecycle.
--
-- 1. tenants + users get a deletion_status + deleted_at (soft delete).
-- 2. users.id stops referencing auth.users(id): deleting the Supabase auth
--    user during account deletion must NOT cascade-delete the audit row.
-- 3. Email uniqueness now applies to ACTIVE accounts only (partial unique
--    index), so the same email can register again after deletion while the
--    old row (anonymized) stays for audit purposes.
-- 4. New account_deletion_jobs table drives the async purge with retries.
-- =============================================================================

CREATE TYPE "public"."deletion_status_enum" AS ENUM ('active', 'deletion_pending', 'deleted');
--> statement-breakpoint
CREATE TYPE "public"."account_deletion_job_status_enum" AS ENUM ('pending', 'purging', 'completed', 'failed');
--> statement-breakpoint
ALTER TABLE "tenants"
    ADD COLUMN IF NOT EXISTS "deletion_status" "deletion_status_enum" NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS "deleted_at" timestamp (3) with time zone;
--> statement-breakpoint
ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "deletion_status" "deletion_status_enum" NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS "deleted_at" timestamp (3) with time zone;
--> statement-breakpoint
-- Detach public.users from auth.users: the auth identity is deleted during
-- account deletion, the public row survives (soft-deleted) for audit.
-- Drop by both possible constraint names: drizzle-generated ("users_id_users_id_fk")
-- and Postgres auto-named ("users_id_fkey") for DBs migrated via direct SQL.
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_id_fkey";
--> statement-breakpoint
-- Email unique only among ACTIVE accounts.
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_unique";
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_key";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_active_email" ON "users" ("email") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account_deletion_jobs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "tenant_id" uuid NOT NULL REFERENCES "public"."tenants"("id") ON DELETE cascade,
    "user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
    "status" "account_deletion_job_status_enum" NOT NULL DEFAULT 'pending',
    "attempt_count" integer NOT NULL DEFAULT 0,
    "last_error" text,
    "completed_at" timestamp (3) with time zone,
    "created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_account_deletion_jobs_status" ON "account_deletion_jobs" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_account_deletion_jobs_tenant" ON "account_deletion_jobs" ("tenant_id");
--> statement-breakpoint
ALTER TYPE "public"."activity_action_enum" ADD VALUE IF NOT EXISTS 'account.deletion_requested';
--> statement-breakpoint
ALTER TYPE "public"."activity_action_enum" ADD VALUE IF NOT EXISTS 'account.deleted';
