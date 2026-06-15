---
title: Wide Events / Canonical Log Lines
impact: CRITICAL
tags: logging, wide-events, canonical-log-lines
---

## Wide Events / Canonical Log Lines

**Impact: CRITICAL**

Wide events (also called canonical log lines) are the foundation of effective logging. For each request, emit **a single context-rich JSON event per service**. Instead of scattering 10-20 log lines throughout your request handler, consolidate everything into one comprehensive event emitted at the end of the request.

### The Pattern

Build the event throughout the request lifecycle, then serialize and print it to `stdout` once at completion in a `finally` block. This ensures the event is always emitted with complete context, even during failures.

**Incorrect:**

```typescript
app.post('/api/search', async (c) => {
  console.log('Received POST /api/search request');

  const { query } = await c.req.json();
  console.log('Query received', { query });

  const tenantId = c.get('tenantId');
  console.log('Tenant context extracted', { tenantId });

  const results = await db.search(tenantId, query);
  console.log('Search completed', { count: results.length });

  console.log('Request completed successfully');
  return c.json(results, 200);
});
// 5 disconnected log lines with scattered context
// Cannot query: "show me all search queries from Free tier tenants that returned 0 results"
```

**Correct:**

```typescript
app.post('/api/search', async (c) => {
  const startTime = Date.now();
  const wideEvent: Record<string, unknown> = {
    method: 'POST',
    path: '/api/search',
    service: 'search-service',
    requestId: c.get('requestId'),
  };

  try {
    const tenantId = c.get('tenantId');
    wideEvent.tenant = {
      id: tenantId,
      tier: c.get('tenantTier'),
    };

    const { query } = await c.req.json();
    wideEvent.search = { query };

    const results = await db.performHybridSearch(tenantId, query);
    wideEvent.search.results_count = results.length;
    wideEvent.search.max_score = results[0]?.score || 0;

    wideEvent.status_code = 200;
    wideEvent.outcome = 'success';
    return c.json(results, 200);
  } catch (error) {
    wideEvent.status_code = error.status || 500;
    wideEvent.outcome = 'error';
    wideEvent.error = {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message,
    };
    throw error;
  } finally {
    wideEvent.duration_ms = Date.now() - startTime;
    wideEvent.timestamp = new Date().toISOString();
    console.log(JSON.stringify(wideEvent)); // Single structured output
  }
});
// Single event with all context - queryable by any field
```

### Connect Events with Request ID

Every wide event must include a unique request ID that is propagated across all service hops. This is the only way to reconstruct the full journey of a request through a distributed system.

```typescript
// Gateway - generate and propagate
const requestId = c.get('requestId') || crypto.randomUUID();
wideEvent.requestId = requestId;

// Propagate downstream to Search Service or AI Gateway
await fetch('http://ai-gateway/v1/chat/completions', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'x-request-id': requestId 
  },
  body: JSON.stringify(data),
});

// Downstream Service - extract and use
const requestId = c.req.header('x-request-id') || crypto.randomUUID();
wideEvent.requestId = requestId; // Same ID links events together
```

### Observability for Streaming Responses (SSE)

For streaming routes like `/api/chat` (RAG Q&A), standard request timing misses crucial details. You must log the **Time-To-First-Token (TTFT)** alongside the total streaming duration.

```typescript
import { streamSSE } from "hono/helper/streaming";

app.post('/api/chat', async (c) => {
  const startTime = Date.now();
  let firstTokenTime: number | null = null;
  
  const wideEvent: Record<string, unknown> = {
    method: 'POST',
    path: '/api/chat',
    service: 'rag-service',
    requestId: c.get('requestId'),
  };

  try {
    const tenantId = c.get('tenantId');
    wideEvent.tenant = { id: tenantId, tier: c.get('tenantTier') };
    
    const { question, conversationId } = await c.req.json();
    wideEvent.chat = { conversationId, has_custom_context: true };

    const stream = await callAiGatewayStream(question, c.get('requestId'));

    return streamSSE(c, async (sseStream) => {
      for await (const chunk of stream) {
        if (!firstTokenTime) {
          firstTokenTime = Date.now();
          wideEvent.ttft_ms = firstTokenTime - startTime;
        }
        await sseStream.writeSSE({
          data: JSON.stringify({ token: chunk.text }),
        });
      }
      wideEvent.status_code = 200;
      wideEvent.outcome = 'success';
      
      // Emit event inside stream completion
      wideEvent.duration_ms = Date.now() - startTime;
      wideEvent.timestamp = new Date().toISOString();
      console.log(JSON.stringify(wideEvent));
    });

  } catch (error) {
    wideEvent.status_code = error.status || 500;
    wideEvent.outcome = 'error';
    wideEvent.error = { code: error.code || 'INTERNAL_ERROR', message: error.message };
    
    wideEvent.duration_ms = Date.now() - startTime;
    wideEvent.timestamp = new Date().toISOString();
    console.log(JSON.stringify(wideEvent));
    throw error;
  }
});
```

### Emit in Finally Block or Stream Cleanup

Always emit wide events in a `finally` block for standard requests, or at the end of the generator/stream block for streaming requests. This guarantees that logs are captured with complete execution metrics regardless of completion status.

Reference: [Stripe Blog - Canonical Log Lines](https://stripe.com/blog/canonical-log-lines)

