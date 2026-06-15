---
name: sse-streaming-engineer
description: Delegates to this agent when implementing SSE (Server-Sent Events) streaming for the RAG Q&A chat endpoint, including backend stream construction, API Gateway passthrough, and SvelteKit frontend consumption.
---

# SSE Streaming Engineer Skill

Use this skill when building or debugging the SSE streaming pipeline for RAG Q&A (PRD §5.4, Sprint 7 task F5.1).

## When to Use
- Building `POST /api/chat` SSE endpoint in the RAG Service.
- Configuring the API Gateway to passthrough SSE without buffering.
- Implementing the SvelteKit chat UI that consumes SSE tokens.
- Debugging token delay, buffering, or stream disconnection issues.

---

## 1. RAG Service — Stream Construction

The RAG Service creates an SSE stream by relaying tokens from the AI API Gateway:

```typescript
import { Context } from "hono";

async function handleChat(c: Context) {
  const { question, conversation_id } = await c.req.json();
  const tenantId = c.get("tenantId");
  const startTime = Date.now();
  let fullAnswer = "";

  // Step 1: Retrieve context chunks via Search Service
  const chunks = await searchService.search(tenantId, question, { topK: 5 });

  // Step 2: Build prompt with enriched context
  const prompt = buildPrompt(question, chunks);

  // Step 3: Call AI API Gateway with streaming
  const aiResponse = await fetch(`${AI_GATEWAY_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: prompt, stream: true }),
  });

  // Step 4: Construct ReadableStream relay
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const reader = aiResponse.body!.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          fullAnswer += extractTokenText(text);
          controller.enqueue(encoder.encode(text));
        }
        controller.enqueue(encoder.encode("event: done\ndata: [DONE]\n\n"));
      } catch (err) {
        const errorEvent = `event: error\ndata: ${JSON.stringify({ code: "STREAM_ERROR" })}\n\n`;
        controller.enqueue(encoder.encode(errorEvent));
      } finally {
        controller.close();
        // Save conversation turn asynchronously (don't block stream close)
        saveConversationTurn({ tenantId, conversationId: conversation_id, question, answer: fullAnswer, chunkIds: chunks.map(c => c.id), latencyMs: Date.now() - startTime }).catch(console.error);
      }
    },
  });

  return c.body(stream, 200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
}
```

---

## 2. API Gateway — Zero-Buffer Passthrough

The gateway proxies `/api/chat` to the RAG Service. It **must not** consume or transform the response body:

```typescript
// In gateway proxy router
app.post("/api/chat", authMiddleware, featureFlagMiddleware("rag_enabled"), async (c) => {
  const upstreamRes = await fetch(RAG_SERVICE_URL, {
    method: "POST",
    headers: { ...forwardHeaders(c), "Content-Type": "application/json" },
    body: await c.req.text(),
  });

  // Direct passthrough — no body consumption
  return c.body(upstreamRes.body!, upstreamRes.status, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
});
```

---

## 3. Frontend — Consuming SSE via Fetch

Since `POST` method is required (and `EventSource` only supports `GET`), use fetch with streaming:

```typescript
async function streamChat(question: string, conversationId?: string) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question, conversation_id: conversationId }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || "Chat request failed");
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value, { stream: true });
    // Parse SSE lines and update reactive UI state
    for (const line of text.split("\n")) {
      if (line.startsWith("data: ") && line !== "data: [DONE]") {
        const token = JSON.parse(line.slice(6));
        appendToken(token); // Update Svelte store
      }
    }
  }
}
```

---

## 4. Performance Metrics to Log

After stream completes, log a wide event including:
- `ttft_ms` — Time to first token (start → first SSE event)
- `total_tokens` — Token count in the complete answer
- `total_duration_ms` — Full stream duration
- `model_used` — Which LLM provider was used
- `context_chunks` — Number of chunks used in prompt
