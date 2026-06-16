---
name: hybrid-search-engineer
description: Delegates to this agent when implementing or optimizing the native Postgres hybrid semantic search pipeline — combining pgvector similarity, PostgreSQL full-text (tsvector), and Reciprocal Rank Fusion (RRF) natively inside the database.
---

# Hybrid Search Engineer Skill

Use this skill when building or optimizing the Search Service (PRD §5.3, Sprint 6 tasks).

## When to Use
- Implementing tenant-safe vector search with pgvector.
- Implementing tenant-safe full-text search with `tsvector` / `tsquery`.
- Building the RRF merge algorithm **natively in Postgres SQL**.
- Configuring circuit breaker degradation inside the Deno API Gateway.

---

## 1. Native Hybrid Search via Postgres RPC (RRF)

We merge keyword and semantic search natively inside Postgres using Reciprocal Rank Fusion (RRF). **Do not perform RRF in the application backend.**

Create a Postgres RPC function that performs both searches and fuses them.
**Crucially, enforce the Tenant ID inside the WHERE clauses** to prevent data leakage.

```sql
create or replace function hybrid_search(
  p_tenant_id text,
  p_query_text text,
  p_query_embedding extensions.vector(768), -- Change dimensions based on Gemini model
  p_match_count int,
  p_full_text_weight float = 1,
  p_semantic_weight float = 1,
  p_rrf_k int = 60
)
returns setof chunks
language sql
as $$
with full_text as (
  select
    id,
    row_number() over(order by ts_rank_cd(ts_content, websearch_to_tsquery('english', p_query_text)) desc) as rank_ix
  from
    chunks
  where
    tenant_id = p_tenant_id -- STRICT TENANT ISOLATION
    and ts_content @@ websearch_to_tsquery('english', p_query_text)
  order by rank_ix
  limit least(p_match_count, 30) * 2
),
semantic as (
  select
    id,
    row_number() over (order by embedding <=> p_query_embedding) as rank_ix
  from
    chunks
  where
    tenant_id = p_tenant_id -- STRICT TENANT ISOLATION
  order by rank_ix
  limit least(p_match_count, 30) * 2
)
select
  chunks.*
from
  full_text
  full outer join semantic
    on full_text.id = semantic.id
  join chunks
    on coalesce(full_text.id, semantic.id) = chunks.id
order by
  coalesce(1.0 / (p_rrf_k + full_text.rank_ix), 0.0) * p_full_text_weight +
  coalesce(1.0 / (p_rrf_k + semantic.rank_ix), 0.0) * p_semantic_weight
  desc
limit
  least(p_match_count, 30)
$$;
```

---

## 2. API Gateway Consumption (Deno)

In the Deno API Gateway, use the Supabase JS client to invoke the RPC function.

```typescript
const { data: chunks, error } = await supabase.rpc('hybrid_search', {
  p_tenant_id: tenantContext.tenantId,
  p_query_text: query,
  p_query_embedding: embedding,
  p_match_count: 10
});
```

---

## 3. Circuit Breaker Degradation

The Deno API Gateway wraps the **Embedding API** call (e.g. Gemini) in a circuit breaker. If the circuit is **open** or the Embedding API fails, we must degrade gracefully to full-text search ONLY.

```typescript
async function executeSearch(tenantId: string, query: string, topK: number) {
  let queryEmbedding: number[] | null = null;

  try {
    // Attempt to embed query (Circuit breaker protected)
    queryEmbedding = await embeddingCircuitBreaker.execute(() => embeddingClient.embed(query));
  } catch (err) {
    logger.warn({ event: "search_degradation", mode: "full-text-only", tenantId });
    // Execute fallback Postgres RPC that only does full-text search
    return await executeFullTextSearch(tenantId, query, topK);
  }

  // Execute Native Hybrid Search
  const { data } = await supabase.rpc('hybrid_search', {
    p_tenant_id: tenantId,
    p_query_text: query,
    p_query_embedding: queryEmbedding,
    p_match_count: topK
  });

  return data;
}
```

---

## 4. Full-Text Search Configuration

The `ts_content` column must be a **generated column** configured via a migration:

```sql
ALTER TABLE chunks
ADD COLUMN ts_content tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

CREATE INDEX on chunks USING gin(ts_content);
```
