# Hybrid Search (dky-014)

**Completed At:** 2026-06-29 16:10
**Status:** Completed & Refactored (Clean Code + Unit Tested)

## Core Logic
The Search endpoint (`/api/search`) receives a plain text query from the user. It splits the work into two parallel paths:
1. **FTS (Full Text Search)**: Queries Postgres `document_chunks` table directly.
2. **Semantic Search**: Calls the LLM Embedding API (e.g. Gemini `text-embedding-004`) to convert the query into a vector, then queries Upstash Vector.

The IDs returned from both sources are scored using the **Reciprocal Rank Fusion (RRF)** algorithm in the Deno memory layer. Finally, the absolute Top-K IDs are gathered from Postgres via a single lazy hydration query to fetch the actual text content.

## Flow Diagram
```mermaid
sequenceDiagram
    participant User
    participant Gateway as API Gateway (Deno)
    participant CircuitBreaker
    participant LLM as Gemini Embedding API
    participant Upstash as Upstash Vector
    participant DB as Postgres FTS

    User->>Gateway: GET /api/search?query=...
    Gateway->>CircuitBreaker: Request Embedding
    CircuitBreaker->>LLM: Embed(query)
    LLM-->>CircuitBreaker: Vector
    
    par Scatter Phase
        Gateway->>Upstash: Search Vector (Top-K IDs)
        Gateway->>DB: FTS Query (Top-K IDs)
    end
    
    Upstash-->>Gateway: [ID1, ID2]
    DB-->>Gateway: [ID2, ID3]
    
    Note over Gateway: Merge Phase: RRF Algorithm
    
    Gateway->>DB: Gather Phase: SELECT * FROM chunks WHERE id IN (...)
    DB-->>Gateway: Full Chunk Content
    Gateway-->>User: JSON Results
```

## Architectural Decisions
1. **Application-Layer RRF**: We do the RRF in Deno, not Postgres, to decouple the vector store from the relational database and save DB CPU.
2. **Circuit Breaker**: The LLM API call is protected by a Redis-backed Circuit Breaker (`infra/circuit-breaker.ts`). If the LLM goes down, the system gracefully degrades to FTS-only without crashing.
3. **Tenant Isolation**: Both FTS and Vector queries strictly enforce `tenant_id` filtering at the scatter phase.
4. **Clean Code Architecture**: Controller logic relies on `ContextExtractor` for tenant verification. `SearchService` operates as a static OOP class accepting single strongly-typed `params` objects inferred from Zod. Guard Clauses are employed outside `try/catch` to ensure error purity.
5. **Robust Mock Testing**: `search.service.test.ts` strictly mocks external integrations (LLM & Vector index) via `jsr:@std/testing/mock` stubs, isolating the DB behavior and RRF scoring algorithms. `search.routes.test.ts` validates the end-to-end integration path.

## File Mapping
- **Routes & Controller**: `apps/backend/src/modules/search/search.routes.ts`, `search.controller.ts`
- **Service logic**: `apps/backend/src/modules/search/search.service.ts`
- **Circuit Breaker**: `apps/backend/src/infra/circuit_breaker.infra.ts`
- **Config**: `apps/backend/src/config/vector.ts`
- **Testing**: `apps/backend/src/modules/search/search.service.test.ts`, `search.routes.test.ts`
