-- =============================================================================
-- 0027: Await attachment ingestion before answering.
--
-- Chat attachments (Opsi C / client-driven flow):
-- 1. A new turn with attachments is created as 'awaiting_indexing' — the
--    request returns immediately, no server-side wait.
-- 2. A Deno.cron sweep (rag.service.ts sweepAwaitingTurns) completes these
--    turns once every attached document reaches 'processed', or marks them
--    'failed' when a document fails.
-- 3. attachment_document_ids persists the scoping ids so the sweep (and the
--    frontend) know which documents the turn waits on — survives reloads and
--    restarts, and enables edit/retry to reuse the same scoping.
--
-- Both statements are idempotent (local DB is migrated by direct SQL).
-- =============================================================================

-- New turn status: created, waiting for the STB worker to finish ingesting
-- the attached documents before the background sweep runs the RAG pipeline.
ALTER TYPE "public"."turn_status_enum" ADD VALUE IF NOT EXISTS 'awaiting_indexing';

-- Attachment document ids (jsonb array of UUIDs). Nullable — only set on
-- turns that carry chat attachments.
ALTER TABLE "conversation_turns"
    ADD COLUMN IF NOT EXISTS "attachment_document_ids" jsonb;

-- BYOK model choice for awaiting turns: the background sweep completes the
-- turn without the client, so the provider/model the user picked must be
-- persisted too. Nullable — system mode (auto) when null.
ALTER TABLE "conversation_turns"
    ADD COLUMN IF NOT EXISTS "model_request" jsonb;
