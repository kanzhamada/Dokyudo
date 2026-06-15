---
trigger: model_decision
description: Enforces correct SSE (Server-Sent Events) streaming behavior across the RAG Service, API Gateway proxy, and SvelteKit frontend to prevent buffering, header misconfiguration, and broken token delivery.
---

# SSE Streaming Policy

## Activation
- **Method**: Model Decision
- **Files**: `apps/backend/src/services/rag/**/*.ts`, `apps/backend/src/gateway/**/*.ts`, `apps/frontend/src/**/*.svelte`, `apps/frontend/src/**/*.ts`

---

## 1. API Gateway Proxy — Zero Buffering

Per PRD §5.4, the API Gateway **MUST NOT** buffer SSE responses from the RAG Service. When proxying `POST /api/chat`:

1. Take the `ReadableStream` from the upstream `fetch()` response.
2. Return it directly using `c.body(stream, 200, headers)`.
3. Never consume or transform the stream body in the gateway.

```typescript
// ✅ CORRECT — passthrough streaming
const upstream = await fetch(ragServiceUrl, { method: "POST", body, headers: reqHeaders });
return c.body(upstream.body!, 200, {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive",
  "X-Accel-Buffering": "no",
});
```

### Forbidden Gateway Patterns

```typescript
// ❌ BAD — consuming the stream breaks SSE
const data = await upstream.json();
return c.json(data);

// ❌ BAD — middleware that reads response body on SSE routes
app.use("/api/chat", responseLogger()); // If it reads body, remove it for this route
```

---

## 2. Mandatory SSE Response Headers

Every SSE response **must** include all four headers. Missing any header can cause proxy-level or browser-level buffering:

| Header | Value | Purpose |
|---|---|---|
| `Content-Type` | `text/event-stream` | Tells browser this is SSE |
| `Cache-Control` | `no-cache` | Prevents response caching |
| `Connection` | `keep-alive` | Maintains persistent connection |
| `X-Accel-Buffering` | `no` | Prevents Nginx/reverse-proxy buffering |

`Transfer-Encoding: chunked` is handled automatically by Deno when a `ReadableStream` body is returned.

---

## 3. RAG Service — Stream Construction

The RAG Service constructs the SSE stream from the AI API Gateway's response:

```typescript
const stream = new ReadableStream({
  async start(controller) {
    const encoder = new TextEncoder();
    try {
      for await (const chunk of aiGatewayResponse.body!) {
        const text = new TextDecoder().decode(chunk);
        // Relay each SSE event as-is
        controller.enqueue(encoder.encode(text));
      }
      // Send completion event
      controller.enqueue(encoder.encode("event: done\ndata: [DONE]\n\n"));
    } catch (error) {
      controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ code: "STREAM_ERROR" })}\n\n`));
    } finally {
      controller.close();
    }
  },
});
```

### Post-Stream Actions

After the stream completes (in the `finally` block or via a background task), the RAG Service **must**:
1. Save the `conversation_turn` to the database (question, accumulated answer, context_chunk_ids, model_used, latency_ms).
2. Log a wide event with streaming metrics (TTFT, total tokens, total duration).

---

## 4. SSE Event Format

All SSE events sent to the frontend must follow this format:

```
event: token
data: {"token": "Hello"}

event: token
data: {"token": " world"}

event: done
data: [DONE]
```

For errors during streaming:
```
event: error
data: {"code": "PROVIDER_UNAVAILABLE", "message": "All LLM providers are unavailable"}
```

---

## 5. Frontend — EventSource Contract

The SvelteKit frontend **must** use the native `fetch` API with streaming (not `EventSource`, since `POST` is required):

```typescript
const response = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ question, conversation_id }),
});

const reader = response.body!.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const text = decoder.decode(value, { stream: true });
  // Parse SSE events from text and update UI
}
```

### Reconnection

If the connection drops mid-stream, the frontend should:
1. Display a user-friendly error message.
2. Offer a "Retry" button that re-sends the question.
3. Not auto-reconnect (since chat is stateful, auto-retry could produce duplicates).
