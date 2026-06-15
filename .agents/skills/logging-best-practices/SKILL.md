---
name: logging-best-practices
description: Logging best practices focused on wide events (canonical log lines) for powerful debugging and analytics
license: MIT
metadata:
  author: boristane
  version: "1.0.0"
---

# Logging Best Practices Skill (Dokyudo Edition)

Version: 1.0.0-dokyudo

## Purpose

This skill provides guidelines for implementing structured logging across **Dokyudo** services. It enforces the **wide events** pattern (canonical log lines) - emitting a single, structured, context-rich JSON event per request/job per service hop to enable powerful debugging, multi-tenant auditing, and analytics (via Grafana Loki).

## When to Apply

Apply these guidelines when:
- Writing or reviewing logging code in the Dokyudo gateway or backend services.
- Implementing middleware or job processors (BullMQ workers).
- Adding observability to external calls (pgvector, LLM APIs, webhooks).
- Defining standardized error structures.

## Core Principles

### 1. Wide Events (CRITICAL)

Consolidate request/job execution logs into a **single structured event** emitted at completion. Do not scatter logs throughout your handler.

```typescript
import { Context } from "hono";

app.post("/api/search", async (c) => {
  const startTime = Date.now();
  const wideEvent: Record<string, unknown> = {
    method: "POST",
    path: "/api/search",
    requestId: c.get("requestId"),
    service: "search-service",
  };

  try {
    const tenantId = c.get("tenantId");
    wideEvent.tenant = { id: tenantId, tier: c.get("tenantTier") };

    const { query } = await c.req.json();
    wideEvent.search = { query };

    const results = await performSearch(tenantId, query);
    wideEvent.search.results_count = results.length;

    wideEvent.status_code = 200;
    wideEvent.outcome = "success";
    return c.json(results);
  } catch (error) {
    wideEvent.status_code = error.status || 500;
    wideEvent.outcome = "error";
    wideEvent.error = { code: error.code || "INTERNAL_ERROR", message: error.message };
    throw error;
  } finally {
    wideEvent.duration_ms = Date.now() - startTime;
    wideEvent.timestamp = new Date().toISOString();
    console.log(JSON.stringify(wideEvent)); // Structured stdout log for Loki
  }
});
```

### 2. Multi-Tenant Business Context (CRITICAL)

Always log the `tenant_id` and tier (`Free` / `Pro`) in every service's wide event. This ensures complete audit logs and enables tracking of tenant quotas and usage patterns.

### 3. Environment Context (CRITICAL)

For Deno 2.x, capture environment metadata from `Deno.env` at startup (e.g. `service_name`, `region`, `commit_hash`) and automatically merge it into every wide event via middleware.

### 4. Correlation (HIGH)

Propagate `x-request-id` across all HTTP service calls (API Gateway -> Search/RAG Service -> AI API Gateway) and embed it in background jobs (BullMQ workers) to link distributed wide events.

### 5. Deno-Native Single Logger (HIGH)

Use standard JSON logging to `stdout` (`console.log(JSON.stringify(wideEvent))`). This avoids external logging package issues in Deno and integrates seamlessly with container aggregation tools (Loki).

### 6. Middleware & Job Wrapper Pattern (HIGH)

Use Hono middleware for HTTP endpoints and a common wrapper for BullMQ worker jobs to manage execution timing, request/job status, error trapping, and wide event emission automatically.

## Anti-Patterns to Avoid

1. **Scattered Logs**: Multiple unstructured console.log() calls per request.
2. **Missing Tenant ID**: Logging technical operations without `tenant_id` context.
3. **No Environment Variables**: Missing commit hash, runtime version, or region info.
4. **Node.js process.env**: Using Node-specific runtime variables instead of `Deno.env.get()`.
5. **No Request Correlation**: Failing to pass or log `x-request-id` to downstream calls/queues.

## Guidelines

### Wide Events (`resources/wide-events.md`)
- Consolidate all parameters, performance metrics, and results.
- Measure time-to-first-token (TTFT) and total duration for streaming responses (SSE).
- propagate `x-request-id` across all downstream services.

### Context (`resources/context.md`)
- Log `tenant_id` and tier on all endpoints.
- Log specific operational context for AI Gateway, Webhook deliveries, and Embedding Workers.
- Inject environment tags (e.g. Deno version, commit hash, service name) on startup.

### Structure (`resources/structure.md`)
- Standardize on JSON serialization to `stdout`.
- Standardize on two levels: `info` (for successful/failed requests) and `error` (for system errors).
- Implement Hono middleware for automatic HTTP logging.

### Common Pitfalls (`resources/pitfalls.md`)
- Avoid unstructured string logs.
- Don't leak raw document text; log document metadata (ID, size, type) instead.
- Avoid logging multiple lines during background processing.

References:
- [Observability Wide Events 101](https://boristane.com/blog/observability-wide-events-101/)
- [Stripe - Canonical Log Lines](https://stripe.com/blog/canonical-log-lines)
- Dokyudo Project Requirements Document (PRD.md)

