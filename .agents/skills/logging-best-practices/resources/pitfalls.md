---
title: Common Pitfalls
impact: MEDIUM
tags: logging, anti-patterns, pitfalls
---

## Common Pitfalls

**Impact: MEDIUM**

Avoid these logging anti-patterns in the Dokyudo codebase to prevent high log noise, performance degradation, and security issues.

### Pitfall 1: Scattered Logs in the Ingestion Pipeline

During document ingestion, the Embedding Worker parses documents, extracts text, chunks it, calls the Embedding API, and upserts to pgvector. Emitting logs for every single chunk creates massive volume (e.g. 500 chunks = 500 log lines per document).

**Incorrect:**
```typescript
// Inside worker loop
for (let i = 0; i < chunks.length; i++) {
  console.log(`Processing chunk ${i} of ${chunks.length}`); // Noise!
  const embedding = await getEmbedding(chunks[i]);
  console.log(`Generated embedding for chunk ${i}`); // Noise!
  await db.upsertChunk(docId, i, embedding);
  console.log(`Upserted chunk ${i} to database`); // Noise!
}
```

**Correct:**
Accumulate execution details in a wide job event and print a single structured log line when the job completes:
```typescript
const jobEvent = {
  job_id: job.id,
  service: "embedding-worker",
  document_id: docId,
  tenant_id: tenantId,
  ingestion: {
    file_size_bytes: file.size,
    chunks_total: chunks.length,
    embedding_model: "text-embedding-3-small",
  },
};

try {
  await processIngestion(chunks);
  jobEvent.status = "completed";
} catch (err) {
  jobEvent.status = "failed";
  jobEvent.error = { message: err.message };
  throw err;
} finally {
  console.log(JSON.stringify(jobEvent));
}
```

### Pitfall 2: Leaking Sensitive Document Text or User Queries

Logging raw document text or entire search query contents can lead to data privacy breaches and bloat index sizes in log aggregators.

**Incorrect:**
```json
{
  "request_id": "req_123",
  "path": "/api/search",
  "search": {
    "query": "confidential health record details for Jane Doe..." 
  }
}
```

**Correct:**
Keep query text in the wide event if needed for search auditing (as queries are typically short), but **never log raw chunk texts** or document contents. Log metadata instead:
```json
{
  "request_id": "req_123",
  "path": "/api/search",
  "search": {
    "query_length": 45,
    "vector_hit_count": 5,
    "fts_hit_count": 3
  }
}
```

### Pitfall 3: Missing Tenant ID in Background Worker Logs

Because background tasks (Embedding, Notification, and Webhook delivery) run asynchronously in separate worker threads, developers often forget to bind them to the executing tenant. This breaks tenant billing audits.

**Incorrect:**
```json
{
  "job_id": "job_web_99",
  "service": "webhook-worker",
  "status": "success",
  "delivery_url": "https://tenant-api.com/webhook"
}
// Which tenant owns this webhook? No tenant_id!
```

**Correct:**
Always propagate the `tenant_id` within the BullMQ job payloads and log it in the worker's wide event:
```json
{
  "job_id": "job_web_99",
  "service": "webhook-worker",
  "tenant_id": "tenant_abc123",
  "status": "success",
  "delivery_url": "https://tenant-api.com/webhook",
  "idempotency_key": "SHA-256...",
  "attempt_number": 1
}
```

### Pitfall 4: Polluting JSON Output with Standard Debug Strings

Writing raw `console.log("here")` or standard output strings in the codebase bypasses structured log serialization. These lines cannot be parsed by Grafana Loki and pollute output tables.

**Incorrect:**
```typescript
console.log("Initialing pgvector connection pool..."); 
// Text line intermixed with JSON log outputs
```

**Correct:**
Standardize all operational messages using the logger instance:
```typescript
logger.info({ event: "pool_init", pool: "postgres", max_connections: 100 });
```
