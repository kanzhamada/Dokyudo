-- =============================================================================
-- 0028: Add document.renamed to the activity action enum.
-- Logged by DocumentsService.updateDocumentTitle (PATCH /api/documents/{id})
-- so the Activity feed shows document renames like any other document event.
-- Idempotent (local DB is migrated by direct SQL).
-- =============================================================================
ALTER TYPE "public"."activity_action_enum" ADD VALUE IF NOT EXISTS 'document.renamed';
