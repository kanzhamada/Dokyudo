-- =============================================================================
-- 0025: Private shares — is_private + access_token on chat_shares, new
-- share_invitees table (email access list).
-- Idempotent (IF NOT EXISTS / DROP IF EXISTS / DO $$ guards): the project
-- applies migrations to local DBs directly as SQL with re-run guards, while
-- staging/prod uses the regular drizzle-kit migrate path.
-- =============================================================================
ALTER TABLE "chat_shares" ADD COLUMN IF NOT EXISTS "is_private" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_shares" ADD COLUMN IF NOT EXISTS "access_token" varchar(64);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "share_invitees" (
	"code" varchar(32) NOT NULL,
	"email" varchar(255) NOT NULL,
	"notified_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "share_invitees_code_chat_shares_code_fk" FOREIGN KEY ("code") REFERENCES "public"."chat_shares"("code") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "share_invitees_code_email_pk" PRIMARY KEY ("code","email")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_share_invitees_email" ON "share_invitees" USING btree ("email");--> statement-breakpoint

-- =============================================================================
-- RLS + grants for share_invitees (scoped through chat_shares.tenant_id —
-- invitees carry no tenant column of their own).
-- =============================================================================
ALTER TABLE "share_invitees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS "share_invitees_authenticated_select" ON "share_invitees";--> statement-breakpoint
CREATE POLICY "share_invitees_authenticated_select" ON "share_invitees" FOR SELECT TO "authenticated" USING (EXISTS (SELECT 1 FROM public.chat_shares cs WHERE cs.code = share_invitees.code AND cs.tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())));--> statement-breakpoint
DROP POLICY IF EXISTS "share_invitees_authenticated_insert" ON "share_invitees";--> statement-breakpoint
CREATE POLICY "share_invitees_authenticated_insert" ON "share_invitees" FOR INSERT TO "authenticated" WITH CHECK (EXISTS (SELECT 1 FROM public.chat_shares cs WHERE cs.code = share_invitees.code AND cs.tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())));--> statement-breakpoint
DROP POLICY IF EXISTS "share_invitees_authenticated_update" ON "share_invitees";--> statement-breakpoint
CREATE POLICY "share_invitees_authenticated_update" ON "share_invitees" FOR UPDATE TO "authenticated" USING (EXISTS (SELECT 1 FROM public.chat_shares cs WHERE cs.code = share_invitees.code AND cs.tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())));--> statement-breakpoint
DROP POLICY IF EXISTS "share_invitees_authenticated_delete" ON "share_invitees";--> statement-breakpoint
CREATE POLICY "share_invitees_authenticated_delete" ON "share_invitees" FOR DELETE TO "authenticated" USING (EXISTS (SELECT 1 FROM public.chat_shares cs WHERE cs.code = share_invitees.code AND cs.tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())));--> statement-breakpoint

-- Anon never reads invitees (verification happens server-side over the
-- superuser connection, so emails/tokens never leak to anon).
REVOKE ALL ON "share_invitees" FROM "anon";--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "share_invitees" TO "authenticated";--> statement-breakpoint

-- =============================================================================
-- chat_shares anon column grant: expose is_private (needed to render the
-- share page), never access_token.
-- =============================================================================
GRANT SELECT ("is_private") ON "chat_shares" TO "anon";--> statement-breakpoint
REVOKE SELECT ("access_token") ON "chat_shares" FROM "anon";
