---
title: Structure and Format
impact: HIGH
tags: logging, json, structured-logging, schema, middleware
---

## Structure and Format

**Impact: HIGH**

Structured logging with consistent formats enables efficient querying and analysis in monitoring tools (such as Grafana Loki). In Deno 2.x, using standard `stdout` (via `console.log`) prevents issues with Node-based binary bindings and allows the container agent to automatically parse the JSON streams.

### Deno-Native Single Logger Pattern

Define a standard, lightweight logger utility in your shared package or backend lib. Configure it once at application startup with environment variables, then import and use it everywhere.

```typescript
// apps/backend/lib/logger.ts

const baseContext = {
  service: Deno.env.get("SERVICE_NAME") || "api-gateway",
  version: Deno.env.get("SERVICE_VERSION") || "0.0.1",
  commit_hash: Deno.env.get("COMMIT_SHA") || "unknown",
  region: Deno.env.get("DENO_REGION") || Deno.env.get("FLY_REGION") || "local",
  environment: Deno.env.get("ENVIRONMENT") || "development",
};

export const logger = {
  info(event: Record<string, unknown>) {
    console.log(JSON.stringify({
      level: "info",
      ...baseContext,
      ...event,
    }));
  },
  error(event: Record<string, unknown>) {
    console.error(JSON.stringify({
      level: "error",
      ...baseContext,
      ...event,
    }));
  }
};
```

**Usage in code:**
```typescript
import { logger } from "./lib/logger.ts";

// Log system startups, cron job firings, or queue connections
logger.info({ event: "db_connected", host: "postgres-db" });
```

### Use Hono Middleware for Consistent Wide Events

Wrap request pipelines in a custom Hono middleware that manages the request lifecycle, traps exceptions, extracts tenant identifiers, measures execution timing, and handles log emission in a final block.

```typescript
// apps/backend/middleware/logging.ts
import type { Context, Next } from "hono";
import { logger } from "../lib/logger.ts";

export async function wideEventMiddleware(c: Context, next: Next) {
  const startTime = Date.now();

  // 1. Extract request identifiers
  const requestId = c.req.header("x-request-id") || crypto.randomUUID();
  c.set("requestId", requestId);

  // 2. Initialize wide event object
  const wideEvent: Record<string, unknown> = {
    request_id: requestId,
    timestamp: new Date().toISOString(),
    method: c.req.method,
    path: c.req.path,
    user_agent: c.req.header("user-agent"),
  };

  // Attach wideEvent to context so handlers can enrich it
  c.set("wideEvent", wideEvent);

  try {
    await next();
    
    // Capture request response outcome
    wideEvent.status_code = c.res.status;
    wideEvent.outcome = c.res.status < 400 ? "success" : "error";

  } catch (error) {
    // 3. Trap uncaught exceptions, populate fields, and rethrow
    wideEvent.status_code = error.status || 500;
    wideEvent.outcome = "error";
    wideEvent.error = {
      code: error.code || "INTERNAL_ERROR",
      message: error.message,
    };
    
    // Log system-level crashes with level: error
    logger.error({
      ...wideEvent,
      message: "Uncaught request exception occurred",
      stack: error.stack,
    });
    
    throw error;
  } finally {
    // 4. Record latency and emit single log line
    wideEvent.duration_ms = Date.now() - startTime;
    
    if (wideEvent.outcome === "success") {
      logger.info(wideEvent);
    }
  }
}
```

### Enriching the Wide Event in Handlers

Request handlers should retrieve the wide event from Hono context and append relevant business metrics:

```typescript
app.post("/api/documents", async (c) => {
  const wideEvent = c.get("wideEvent");
  
  // Attach tenant and auth details
  wideEvent.tenant = { id: c.get("tenantId"), tier: c.get("tenantTier") };
  wideEvent.user = { id: c.get("userId") };

  const { filename, size_bytes, mime_type } = await c.req.json();
  
  // Attach operation context
  wideEvent.document = { filename, size_bytes, mime_type };

  // ... execute ingestion trigger ...
  
  return c.json({ status: "processing" }, 202);
});
```

### Simplify Log Levels

Stick to two main logging levels:
- **INFO**: Standard logs, successful requests, normal service states, and expected user errors (like `401 Unauthorized` or `429 Rate Limit Exceeded`).
- **ERROR**: Internal service failures, system exceptions, db network timeouts, and dependency crashes that require operations paging.

### Never Log Unstructured Strings

Every log output must be a single-line JSON payload. Unstructured strings like `console.log("Database connection successful")` degrade observability since parser agents (Loki) cannot split them into structured fields automatically.
