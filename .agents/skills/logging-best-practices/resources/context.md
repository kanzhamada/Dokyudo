---
title: Context, Cardinality, and Dimensionality
impact: CRITICAL
tags: logging, context, cardinality, dimensionality
---

## Context, Cardinality, and Dimensionality

**Impact: CRITICAL**

Wide events must be context-rich with high cardinality and high dimensionality. This enables you to answer questions you haven't anticipated yet - the "unknown unknowns" that traditional logging misses.

### High Cardinality

High cardinality means a field can have millions or billions of unique values. 

In Dokyudo, key high cardinality fields include:
- `requestId` / `request_id`: Traces a request across all services.
- `tenant_id`: Essential for isolating logs by tenant.
- `user_id`: Identifies the specific actor.
- `document_id`: Identifies the document being processed, uploaded, or indexed.
- `conversation_id`: Identifies the specific RAG chat thread.
- `chunk_id`: References individual document slices.

Your logging must support querying against any specific value of these fields. Without high cardinality support, you cannot audit or debug issues for specific tenants or documents.

### High Dimensionality

High dimensionality means your events have many fields (20-100+). More dimensions mean more questions you can answer without redeploying code.

Here is a blueprint of a complete Dokyudo RAG Q&A wide event:

```typescript
const wideEvent = {
  // Timing
  timestamp: '2026-06-05T10:20:00.123Z',
  duration_ms: 1450,
  ttft_ms: 820, // Time-to-first-token for streaming

  // Request context
  method: 'POST',
  path: '/api/chat',
  requestId: 'req_9a8b7c6d5e',

  // Environment (added automatically at startup)
  env: {
    service: 'rag-service',
    version: '1.2.0',
    environment: 'production',
    region: 'ord', // Deno Deploy region
    commit_hash: '8f4c29a',
    deno_version: '2.1.2',
  },

  // Tenant/User Context (HIGH CARDINALITY & BUSINESS CONTEXT)
  tenant: {
    id: 'tenant_abc123',
    tier: 'Pro', // Free vs Pro
    searches_this_month: 245,
    qna_this_month: 18,
  },
  user: {
    id: 'user_xyz888',
  },

  // Feature flags active for the tenant
  feature_flags: {
    rag_enabled: true,
    sharing_enabled: false,
  },

  // Domain context - RAG search inputs & metrics
  chat: {
    conversation_id: 'conv_444555',
    turn_index: 3,
    question_length_chars: 58,
  },
  
  // Downstream Search Context
  search: {
    retrieved_chunk_count: 5,
    retrieved_chunk_ids: [
      'chunk_u1', 'chunk_u2', 'chunk_u3', 'chunk_u4', 'chunk_u5'
    ],
    max_relevance_score: 0.92,
    fallback_to_fts: false, // Whether hybrid search degraded to full-text only
  },

  // Downstream LLM Provider context
  ai_gateway: {
    provider_selected: 'openai',
    model_used: 'gpt-4o',
    prompt_tokens: 1850,
    completion_tokens: 220,
    circuit_breaker_status: 'closed', // Circuit breaker status for OpenAI
    attempts: 1,
  },

  // Outcome
  status_code: 200,
  outcome: 'success',
};
```

### Always Include Business Context

Include business-specific context, not just technical details. In Dokyudo, this is critical because quotas are enforced per tier:

- **Tier Status**: If a Pro tenant is getting rate limited or a Free tenant hits a quota block (`QUOTA_EXCEEDED` / `429`), the logs must explicitly state the limits:
  ```json
  "tenant": {
    "id": "tenant_free_444",
    "tier": "Free",
    "uploads_limit": 10,
    "uploads_used": 10
  }
  ```
- **Feature Flags**: Gateway logs must include evaluated feature flags for the tenant (e.g., `rag_enabled`) so that when a tenant receives a `403 FEATURE_DISABLED` error, we can instantly verify whether their flag was active.

This business context changes your debugging priority from "Endpoint returned 429" to "A Pro tenant who has paid for 1000 searches was blocked at 50 searches."

### Always Include Deno Environment Characteristics

Include Deno runtime and environment characteristics in every wide event. This context is essential for correlating issues with deployments and identifying region-specific problems.

Capture these variables in Deno:

```typescript
const envContext = {
  service: Deno.env.get("SERVICE_NAME") || "unknown-service",
  version: Deno.env.get("SERVICE_VERSION") || "0.0.1",
  environment: Deno.env.get("ENVIRONMENT") || Deno.env.get("NODE_ENV") || "development",
  region: Deno.env.get("DENO_REGION") || Deno.env.get("FLY_REGION") || "local",
  commit_hash: Deno.env.get("COMMIT_SHA") || Deno.env.get("GIT_COMMIT") || "unknown",
  deno_version: Deno.version.deno,
  instance_id: Deno.env.get("HOSTNAME") || "unknown-host",
};
```

**Why environment context matters:**

- **commit_hash**: Instantly identify which git SHA introduced an issue.
- **region**: Check if LLM latency spikes or pgvector connection timeouts are region-specific (e.g. `ord` vs `hkg` deployments on Deno Deploy).
- **deno_version**: Track compatibility issues after major Deno version upgrades.

This environment context must be loaded once at service startup and automatically injected into the wide event builder.
