ALTER TABLE "document_chunks" drop column "fts";--> statement-breakpoint
ALTER TABLE "document_chunks" ADD COLUMN "fts" "tsvector" GENERATED ALWAYS AS (to_tsvector('indonesian', content) || to_tsvector('english', content)) STORED;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
CREATE INDEX "idx_document_chunks_tenant" ON "document_chunks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "idx_document_chunks_fts" ON "document_chunks" USING gin ("fts");