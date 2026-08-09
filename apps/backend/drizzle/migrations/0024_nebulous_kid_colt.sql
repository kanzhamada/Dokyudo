CREATE TABLE IF NOT EXISTS "chat_shares" (
	"code" varchar(32) PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_by" uuid,
	"conversation_id" uuid NOT NULL,
	"boundary_turn_id" uuid,
	"title" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_shares_tenant_id_tenants_id_fk') THEN
        ALTER TABLE "chat_shares" ADD CONSTRAINT "chat_shares_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_shares_created_by_users_id_fk') THEN
        ALTER TABLE "chat_shares" ADD CONSTRAINT "chat_shares_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_shares_conversation_id_conversations_id_fk') THEN
        ALTER TABLE "chat_shares" ADD CONSTRAINT "chat_shares_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_chat_shares_tenant" ON "chat_shares" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_chat_shares_conversation" ON "chat_shares" USING btree ("conversation_id");--> statement-breakpoint

-- =============================================================================
-- RLS + grants for chat_shares (multi-tenancy isolation, same contract as the
-- other tenant-scoped tables: application-layer WHERE tenant_id + RLS layer).
-- Idempotent (IF NOT EXISTS / DROP IF EXISTS): this project applies migrations
-- to local DBs directly as SQL with re-run guards (see rag-turn-status docs),
-- while staging/prod uses the regular drizzle-kit migrate path.
-- =============================================================================
ALTER TABLE "chat_shares" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Authenticated: full CRUD scoped to the caller's own tenant.
DROP POLICY IF EXISTS "chat_shares_authenticated_select" ON "chat_shares";--> statement-breakpoint
CREATE POLICY "chat_shares_authenticated_select" ON "chat_shares" FOR SELECT TO "authenticated" USING ("tenant_id" = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));--> statement-breakpoint
DROP POLICY IF EXISTS "chat_shares_authenticated_insert" ON "chat_shares";--> statement-breakpoint
CREATE POLICY "chat_shares_authenticated_insert" ON "chat_shares" FOR INSERT TO "authenticated" WITH CHECK ("tenant_id" = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));--> statement-breakpoint
DROP POLICY IF EXISTS "chat_shares_authenticated_update" ON "chat_shares";--> statement-breakpoint
CREATE POLICY "chat_shares_authenticated_update" ON "chat_shares" FOR UPDATE TO "authenticated" USING ("tenant_id" = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));--> statement-breakpoint
DROP POLICY IF EXISTS "chat_shares_authenticated_delete" ON "chat_shares";--> statement-breakpoint
CREATE POLICY "chat_shares_authenticated_delete" ON "chat_shares" FOR DELETE TO "authenticated" USING ("tenant_id" = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));--> statement-breakpoint

-- Anon: SELECT only non-expired rows (public share reads run as the anon role
-- via withAnonDb — never through the app's authenticated session).
DROP POLICY IF EXISTS "chat_shares_anon_select" ON "chat_shares";--> statement-breakpoint
CREATE POLICY "chat_shares_anon_select" ON "chat_shares" FOR SELECT TO "anon" USING ("expires_at" IS NULL OR "expires_at" > now());--> statement-breakpoint

-- Explicit grants (deterministic even without Supabase default privileges).
GRANT SELECT, INSERT, UPDATE, DELETE ON "chat_shares" TO "authenticated";--> statement-breakpoint
-- Column-level grant: anon viewers can never read tenant_id / created_by.
-- REVOKE first: Supabase default privileges grant ALL (incl. every column) to
-- anon on new tables, which would leak tenant_id / created_by past the policy.
REVOKE ALL ON "chat_shares" FROM "anon";--> statement-breakpoint
GRANT SELECT ("code", "title", "snapshot", "expires_at", "conversation_id", "boundary_turn_id", "created_at") ON "chat_shares" TO "anon";
