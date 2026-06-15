---
trigger: model_decision
description: Enforces the PRD-defined standard JSON error envelope and exhaustive error code list across all backend services and the AI API Gateway.
---

# Standard Error Response Envelope

## Activation
- **Method**: Always On
- **Files**: `apps/backend/src/**/*.ts`, `apps/ai-gateway/src/**/*.ts`

---

## 1. Mandatory Error Envelope

Every error response from any service **must** conform to the following JSON structure (PRD §5.12):

```json
{
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "message": "Human readable description",
    "retryAfter": 30,
    "requestId": "uuid"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `code` | `string` | ✅ Always | Machine-readable error code from the approved list |
| `message` | `string` | ✅ Always | Human-readable explanation for debugging |
| `retryAfter` | `number` | ⚠️ Conditional | Seconds until retry is safe. Required for `RATE_LIMIT_EXCEEDED` and `QUOTA_EXCEEDED` |
| `requestId` | `string` | ✅ Always | UUID propagated from `X-Request-ID` header |

---

## 2. Approved Error Codes (Exhaustive List)

You are **strictly forbidden** from inventing custom error codes not in this list. If a new error scenario arises, propose adding it to this list first.

| Code | HTTP Status | When to Use |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing, invalid, or expired JWT; invalid credentials |
| `FORBIDDEN` | 403 | Valid auth but insufficient role (e.g., tenant accessing admin route) |
| `FEATURE_DISABLED` | 403 | Feature flag is off for this tenant |
| `RATE_LIMIT_EXCEEDED` | 429 | Sliding window rate limit hit; include `retryAfter` |
| `QUOTA_EXCEEDED` | 429 | Monthly quota depleted; include `retryAfter` (seconds until month reset) |
| `DOCUMENT_NOT_READY` | 409 | Document still processing; search/chat attempted on unready doc |
| `PROVIDER_UNAVAILABLE` | 503 | All LLM providers down or circuit breakers open |
| `VALIDATION_ERROR` | 400 | Zod validation failure; malformed input |
| `INTERNAL_ERROR` | 500 | Unexpected server error; details logged, not exposed to client |

---

## 3. Implementation Pattern

Use a shared error class hierarchy to ensure consistent envelope construction:

```typescript
// packages/shared/errors.ts
interface AppErrorOptions {
  code: string;
  message: string;
  status: number;
  retryAfter?: number;
}

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryAfter?: number;

  constructor({ code, message, status, retryAfter }: AppErrorOptions) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }

  toJSON(requestId: string) {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.retryAfter !== undefined && { retryAfter: this.retryAfter }),
        requestId,
      },
    };
  }
}
```

---

## 4. Global Error Handler

The Hono API Gateway **must** have a global `onError` handler that catches all thrown errors and formats them into the standard envelope. Raw error objects, stack traces, or unstructured strings must **never** leak to the client.

```typescript
app.onError((err, c) => {
  const requestId = c.get("requestId") || crypto.randomUUID();

  if (err instanceof AppError) {
    return c.json(err.toJSON(requestId), err.status);
  }

  // Unknown error — log full details, return generic envelope
  console.error(JSON.stringify({ requestId, error: err.message, stack: err.stack }));
  return c.json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      requestId,
    },
  }, 500);
});
```

---

## 5. Forbidden Patterns

```typescript
// ❌ BAD — raw string error
return c.json({ error: "Something went wrong" }, 500);

// ❌ BAD — non-standard code
return c.json({ error: { code: "DOC_UPLOAD_FAILED", message: "..." } }, 400);

// ❌ BAD — missing requestId
return c.json({ error: { code: "VALIDATION_ERROR", message: "..." } }, 400);

// ✅ GOOD — standard envelope via AppError
throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid file type", status: 400 });
```
