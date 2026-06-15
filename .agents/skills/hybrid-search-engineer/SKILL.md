---
name: hybrid-search-engineer
description: Delegates to this agent when implementing or optimizing the hybrid semantic search pipeline — pgvector similarity, PostgreSQL full-text (tsvector), Reciprocal Rank Fusion (RRF) merge, and circuit breaker degradation.
---

# Hybrid Search Engineer Skill

Use this skill when building or optimizing the Search Service (PRD §5.3, Sprint 6 tasks F4.1–F4.6).

## When to Use
- Implementing tenant-safe vector search with pgvector.
- Implementing tenant-safe full-text search with `tsvector` / `tsquery`.
- Building the RRF merge algorithm.
- Configuring circuit breaker degradation (hybrid → full-text only).
- Tuning search relevance or query performance.

---

## 1. Tenant-Safe Vector Search

All vector queries **must** filter by `tenant_id` inside the SQL, not post-retrieval:

```sql
SELECT id, doc_id, content, chunk_index,
       1 - (embedding <=> $2) AS vector_score
FROM chunks
WHERE tenant_id = $1
ORDER BY embedding <=> $2
LIMIT $3;
```

In Drizzle ORM:
```typescript
const vectorResults = await db
  .select({ id: chunks.id, docId: chunks.docId, content: chunks.content, score: sql`1 - (${chunks.embedding} <=> ${queryEmbedding})` })
  .from(chunks)
  .where(eq(chunks.tenantId, tenantId))
  .orderBy(sql`${chunks.embedding} <=> ${queryEmbedding}`)
  .limit(topK);
```

---

## 2. Tenant-Safe Full-Text Search

The `ts_content` column is a **generated column** — never write to it manually:

```sql
-- Schema definition (Drizzle migration)
ts_content tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
```

Query pattern:
```sql
SELECT id, doc_id, content, chunk_index,
       ts_rank(ts_content, to_tsquery('english', $2)) AS fts_score
FROM chunks
WHERE tenant_id = $1
  AND ts_content @@ to_tsquery('english', $2)
ORDER BY fts_score DESC
LIMIT $3;
```

---

## 3. Reciprocal Rank Fusion (RRF)

Merge vector and full-text results using RRF with constant `k = 60`:

```typescript
interface SearchResult {
  id: string;
  docId: string;
  content: string;
  score: number;
}

interface RRFConfig {
  k: number;  // Default: 60
}

function reciprocalRankFusion(
  vectorResults: SearchResult[],
  ftsResults: SearchResult[],
  config: RRFConfig = { k: 60 }
): SearchResult[] {
  const scores = new Map<string, { result: SearchResult; rrfScore: number }>();

  const len1 = vectorResults.length;
  for (let i = 0; i < len1; i++) {
    const r = vectorResults[i];
    const rrfScore = 1 / (config.k + i + 1);
    scores.set(r.id, { result: r, rrfScore });
  }

  const len2 = ftsResults.length;
  for (let i = 0; i < len2; i++) {
    const r = ftsResults[i];
    const rrfScore = 1 / (config.k + i + 1);
    const existing = scores.get(r.id);
    if (existing) {
      existing.rrfScore += rrfScore;
    } else {
      scores.set(r.id, { result: r, rrfScore });
    }
  }

  return Array.from(scores.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .map(({ result, rrfScore }) => ({ ...result, score: rrfScore }));
}
```

---

## 4. Circuit Breaker Degradation

The Search Service wraps pgvector calls in a circuit breaker. When the circuit is **open**:

1. **Skip** the vector search entirely (do not queue it, do not wait).
2. Execute **full-text search only** as the degraded path.
3. Log a wide event: `{ degradation: "full-text-only", reason: "circuit_breaker_open" }`.
4. Return results normally — the client does not need to know about degradation.

If the **Embedding API** is unavailable (cannot embed the query), the same degradation applies: fall back to full-text only.

```typescript
async function hybridSearch(tenantId: string, query: string, topK: number) {
  let vectorResults: SearchResult[] = [];
  let queryEmbedding: number[] | null = null;

  // Attempt embedding + vector search (circuit breaker protected)
  try {
    queryEmbedding = await embeddingClient.embed(query);
    vectorResults = await pgvectorCircuitBreaker.execute(() =>
      executeVectorSearch(tenantId, queryEmbedding!, topK)
    );
  } catch {
    // Degradation: proceed with full-text only
    logger.warn({ event: "search_degradation", mode: "full-text-only", tenantId });
  }

  const ftsResults = await executeFullTextSearch(tenantId, query, topK);

  if (vectorResults.length === 0) return ftsResults;
  return reciprocalRankFusion(vectorResults, ftsResults);
}
```

---

## 5. Performance Targets

From PRD §6 Non-Functional Requirements:
- Hybrid search end-to-end (gateway → embedding → DB → response): **< 500ms at P95**
- If embedding API adds > 200ms, target becomes **< 700ms**
- Always parallelize vector + full-text queries with `Promise.all` when both are available
