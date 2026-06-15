---
trigger: model_decision
description: Enforces consistent circuit breaker configuration, instantiation, and fallback behavior across all backend services that depend on external resources (pgvector, LLM providers, webhook URLs).
---

# Circuit Breaker Contract

## Activation
- **Method**: Always On
- **Files**: `apps/backend/src/**/*.ts`, `apps/ai-gateway/src/**/*.ts`

---

## 1. Canonical Default Values

All circuit breaker instances **must** use the following defaults from PRD §5.13 unless explicitly overridden via environment variables:

| Parameter | Default | Env Override |
|---|---|---|
| Failure threshold | 5 failures | `CB_FAILURE_THRESHOLD` |
| Sliding window | 10 seconds | `CB_WINDOW_MS` |
| Open duration | 30 seconds | `CB_OPEN_DURATION_MS` |
| Half-open probe count | 1 successful probe to close | `CB_HALF_OPEN_PROBES` |

**You are forbidden from hardcoding numeric values inline.** Import defaults from the shared constants module:

```typescript
// packages/shared/constants/circuit-breaker.ts
export const CB_DEFAULTS = {
  failureThreshold: 5,
  windowMs: 10_000,
  openDurationMs: 30_000,
  halfOpenProbes: 1,
} as const;
```

---

## 2. Shared Factory Mandate

Every circuit breaker **must** be instantiated through the shared factory at `apps/backend/src/infra/circuit-breaker.ts` (or `apps/ai-gateway/src/routing/circuit-breaker.ts` for the AI Gateway). Do not create ad-hoc circuit breaker implementations.

```typescript
// ✅ GOOD — factory with named instance
const pgvectorCB = createCircuitBreaker("pgvector-search", {
  ...CB_DEFAULTS,
  failureThreshold: Number(Deno.env.get("CB_PGVECTOR_FAILURE_THRESHOLD")) || CB_DEFAULTS.failureThreshold,
});

// ❌ BAD — inline implementation with magic numbers
let failures = 0;
if (failures > 5) { /* skip call */ }
```

---

## 3. Mandatory Application Points

Circuit breakers are **required** on the following external dependencies. Missing any of these is a blocking defect:

| Dependency | Service | Instance Name |
|---|---|---|
| pgvector similarity queries | Search Service | `pgvector-search` |
| OpenAI LLM provider | AI API Gateway | `llm-openai` |
| Anthropic LLM provider | AI API Gateway | `llm-anthropic` |
| Ollama LLM provider | AI API Gateway | `llm-ollama` |
| Each tenant webhook URL | Webhook Worker | `webhook-{tenantId}-{webhookId}` |

---

## 4. State Transition Logging

Every circuit breaker state transition (`closed → open`, `open → half-open`, `half-open → closed`) **must** emit a structured wide event log entry:

```typescript
{
  event: "circuit_breaker_state_change",
  instance: "pgvector-search",
  from: "closed",
  to: "open",
  failureCount: 5,
  windowMs: 10000,
  timestamp: "2026-06-07T09:00:00.000Z"
}
```

---

## 5. Fallback Behavior Contract

When a circuit breaker is **open**, the service **must** degrade gracefully — never throw an unhandled error or return a raw 500.

| Service | Open-State Fallback |
|---|---|
| Search Service (pgvector) | Degrade to full-text search only; log degradation in wide event |
| AI API Gateway | Route to next provider in fallback chain; if all open → return `PROVIDER_UNAVAILABLE` |
| Webhook Worker | Skip delivery attempt; log to `webhook_logs` with `status = "circuit_open"`; do **not** consume the retry count |
