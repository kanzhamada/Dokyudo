---
trigger: always_on
---

# Expert Performance & Best Practices Engineering Policy

This rule enforces high-performance computing, clean code conventions, and compile-time TypeScript optimization across both the Deno backend (`apps/backend`) and SvelteKit frontend (`apps/frontend`). You must write code like a Principal Software Engineer, prioritizing P95 latency and compiler memory efficiency.

## Activation
- **Method**: Always On
- **Files**: `*.ts`, `*.svelte`

---

## 1. High-Throughput Iteration & Loop Efficiency

When handling large arrays, document strings, token arrays, or bulk dataset parsing (especially within the Ingestion Service and Chunking pipelines):

* **Banned**: Never use `for...in` loops to iterate over arrays.
* **Restricted**: Avoid higher-order methods (`.map()`, `.forEach()`, `.reduce()`) inside dense data manipulation loops or pipelines processing > 10,000 data elements due to callback allocation overhead.
* **Mandated**: Use traditional `for` loops or `while` loops with a **cached length variable** for critical performance paths.

### Correct High-Performance Array Loop Pattern:
```typescript
// Optimizing text token/chunk iterations
const len = arrayData.length; 
let combinedSum = 0;
for (let i = 0; i < len; i++) {
  combinedSum += arrayData[i];
}

```

---

## 2. TypeScript Compile-Time & Type-Checking Optimization

Sluggish IDE responses and compiler memory exhaustion block production pipelines. Protect the TypeScript Language Server by optimizing type evaluations:

* **Prefer Interfaces Over Intersections**: Object extensions must use `interface X extends Y` instead of type intersections (`type X = Y & Z`). Interfaces cache type relationships more efficiently.
* **Name Complex Conditional Types**: Do not inline deep conditional types directly into function return signatures. Extract them into a dedicated named type alias to enable compiler caching.
* **Order of Conditionals**: Structure conditional types so that the most common or computationally expensive cases match first, reducing execution steps inside the compiler.

### Correct Type Optimization Pattern:

```typescript
// Good: Cached and easily flattable by the compiler
interface SecureTenantSession extends TenantContext {
  jwtExpiryTimestamp: number;
}

```

---

## 3. High-Performance API Engineering & Concurrency

To satisfy Dokyudo's strict non-functional constraints (P95 latency < 500ms for hybrid searches), adhere to these networking guidelines:

* **Asynchronous Parallelization**: Never await independent async requests sequentially. If fetching multiple context paths, parallelize them using `Promise.all`.
* **Persistent Connections**: Configure internal service-to-service requests (like calls to the AI API Gateway) to use persistent HTTP connections (`keep-alive`) to eliminate connection-handshake latency.

### Correct Concurrency Pattern:

```typescript
// Concurrently executing pgvector search and full-text search components
const [vectorResults, fullTextResults] = await Promise.all([
  executeVectorSearch(tenantId, queryEmbedding),
  executeFullTextSearch(tenantId, queryText)
]);

```

---

## 4. Defensively Designed Clean Functions

To guarantee long-term code maintainability, minimize bug surface areas, and maximize testing ease:

* **Parameter Thresholds**: Functions should ideally accept **0 to 2 parameters**. A maximum of 3 positional parameters is tolerated only for simple utility primitives.
* **Configuration Objects**: If a function requires 4 or more pieces of input configuration, you **must** refactor the arguments into a single structured object and utilize TypeScript object destructuring.

### Correct Clean Function Pattern:

```typescript
// Good: Self-documenting object configuration payload for complex workflows
interface IngestionConfig {
  docId: string;
  storagePath: string;
  mimeType: string;
  maxTokens?: number;
  overlapPercentage?: number;
}

async function runIngestionPipeline({ docId, storagePath, mimeType, maxTokens = 512, overlapPercentage = 0.15 }: IngestionConfig) {
  // Implementation code...
}

```
