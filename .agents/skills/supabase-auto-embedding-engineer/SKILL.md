---
name: supabase-auto-embedding-engineer
description: Delegates to this agent when building the automatic embedding pipeline using Supabase pgmq, pg_cron, triggers, pg_net, and Edge Functions.
---

# Supabase Auto-Embedding Engineer Skill

Use this skill when implementing Document Ingestion and Vector Embedding flows (PRD §5.2).

## Architecture

We use a database-driven architecture to automatically generate embeddings when text chunks are inserted into the database. This replaces legacy external workers (e.g., BullMQ).

### Required Extensions
Ensure these extensions are enabled via migrations:
- `vector`
- `pgmq`
- `pg_net`
- `pg_cron`
- `hstore`

### Workflow
1. **Trigger**: An `after insert` or `after update` Postgres trigger fires on the `chunks` table.
2. **pgmq**: The trigger function uses `pgmq.send()` to queue the `chunk_id` and text content into the `embedding_jobs` queue.
3. **pg_cron**: A `pg_cron` job scheduled to run continuously (e.g. every 10 seconds) reads batches of jobs from `pgmq`.
4. **pg_net / Edge Function**: The cron job aggregates jobs into JSON and uses `pg_net.http_post` to invoke a Supabase Edge Function (`/functions/v1/embed`).
5. **Embedding API**: The Supabase Edge Function loops through the batch, calls the external Embedding API (Gemini API), and writes the resulting vector array directly into the database row via SQL `UPDATE`.
6. **Cleanup**: Upon successful update, the Edge Function deletes the job from `pgmq`. If an error occurs, the job is left in the queue until its visibility timeout expires, and it gets automatically retried in the next batch.

### Key Guidelines

- **Batching**: Always batch requests from Postgres into the Edge Function to optimize API limits and connection overhead.
- **Failures**: Rely on `pgmq`'s visibility timeout (`vt`) to handle retries natively.
- **Null Initialization**: Insert text chunks with a `NULL` vector column. It will be updated asynchronously.
- **Update Handling**: If text content changes, use a `before update` trigger with `hstore` to nullify the vector column, preventing stale embeddings while the new one is queued.
