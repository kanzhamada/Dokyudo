---
trigger: model_decision
description: Enforces the canonical Redis key schema defined in the PRD to prevent key collisions, data leaks, and debugging nightmares across all backend services.
---

# Redis Key Schema Enforcement

## Activation
- **Method**: Always On
- **Files**: `apps/backend/src/**/*.ts`

---

## 1. Canonical Key Patterns

All Redis keys **must** follow the exact formats defined in PRD §5.5. No service may invent custom key patterns without first updating this rule and the shared constants module.

| Purpose | Key Format | Value Type | TTL |
|---|---|---|---|
| **Sessions** | `session:{sha256(refreshToken)}` | JSON `{userId, tenantId, exp}` | 24 hours |
| **Rate Limiting** | `rate_limit:{tenantId}:{endpoint}` | Sorted set (sliding window ZSET) | Auto-expire via ZREMRANGEBYSCORE |
| **OAuth CSRF State** | `oauth:{state}` | String `{provider}` | 5 minutes (single-use: delete after validation) |
| **Feature Flag Cache** | `flag:{flagName}:{tenantId}` | String `"true"` or `"false"` | 30 seconds |

---

## 2. Shared Constants Mandate

All key patterns **must** be constructed using helper functions or template literals exported from:

```
packages/shared/constants/redis-keys.ts
```

Example implementation:

```typescript
import { createHash } from "node:crypto";

export const RedisKeys = {
  session: (refreshToken: string) =>
    `session:${createHash("sha256").update(refreshToken).digest("hex")}`,

  rateLimit: (tenantId: string, endpoint: string) =>
    `rate_limit:${tenantId}:${endpoint}`,

  oauthState: (state: string) =>
    `oauth:${state}`,

  featureFlag: (flagName: string, tenantId: string) =>
    `flag:${flagName}:${tenantId}`,
} as const;
```

### Forbidden Patterns

```typescript
// ❌ BAD — hardcoded inline key
await redis.get(`session:${tokenHash}`);

// ❌ BAD — invented key format
await redis.set(`user_session_${userId}`, data);

// ✅ GOOD — shared constant
await redis.get(RedisKeys.session(refreshToken));
```

---

## 3. TTL Enforcement

Every `SET` or equivalent write operation on a Redis key **must** include an explicit TTL. Keys without TTLs risk memory leaks and stale data.

| Key Category | TTL | Enforcement |
|---|---|---|
| Sessions | `EX 86400` (24h) | Mandatory |
| OAuth state | `EX 300` (5 min) | Mandatory |
| Feature flags | `EX 30` (30s) | Mandatory |
| Rate limit ZSET | Members auto-pruned by sliding window logic | ZREMRANGEBYSCORE on each check |

---

## 4. Single-Use Key Deletion

OAuth state keys (`oauth:{state}`) are **single-use**. The callback handler **must** delete the key from Redis immediately after reading it, before proceeding with any other logic. This prevents CSRF replay attacks.

```typescript
// ✅ Correct — atomic read + delete
const provider = await redis.get(RedisKeys.oauthState(state));
if (!provider) throw new UnauthorizedError("Invalid or expired OAuth state");
await redis.del(RedisKeys.oauthState(state)); // Delete immediately
// ... proceed with code exchange
```

---

## 5. Namespace Isolation

Never use bare keys (e.g., `userId`, `config`). All keys must be prefixed with their domain namespace as defined in the patterns above. This prevents accidental collisions between subsystems.
