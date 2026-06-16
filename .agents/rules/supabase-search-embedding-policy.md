---
trigger: always_on
description: Enforces the use of Supabase native features for vector embeddings and hybrid search over application-level implementations.
---

# Supabase Native Search & Embedding Policy

## Activation
- **Method**: Always On
- **Files**: `apps/backend/**/*.ts`, `supabase/migrations/**/*.sql`, `supabase/functions/**/*.ts`

---

## 1. Automatic Embeddings Mandate
Vector embeddings must be generated asynchronously within the database layer using Supabase features, **not** via an external Node/Deno worker pulling from a message queue.

You must follow the standard Supabase Automatic Embeddings architecture:
1. **Triggers**: Use Postgres triggers to detect new/updated text rows.
2. **pgmq**: Queue the job natively using the `pgmq` extension.
3. **pg_cron**: Periodically process the queue (e.g., every 10 seconds).
4. **Edge Functions**: The `pg_cron` schedule must use `pg_net` to call a Supabase Edge Function.
5. **Generation**: The Edge Function calls the Embedding API (e.g., Gemini) and updates the vector column via SQL.

**Forbidden**: Do not use BullMQ, Redis queues, or separate background workers for generating vector embeddings from document chunks.

---

## 2. Native Hybrid Search Mandate
Reciprocal Rank Fusion (RRF) must be executed natively in Postgres, **not** in application code.

When executing a hybrid search:
1. The Deno API Gateway should embed the user query.
2. The Gateway must call a native Postgres RPC function (e.g., `hybrid_search(query_text, query_embedding, match_count)`).
3. The SQL RPC function must execute both the `tsvector` keyword search and the `pgvector` similarity search, combine them using RRF using SQL logic, and return the final sorted results.

**Forbidden**: Do not execute full-text and vector searches in parallel via `Promise.all` in the Deno backend and merge their results using JavaScript/TypeScript arrays. All merging and ranking must happen in the SQL layer.
