---
trigger: model_decision
description: Enforces the PRD-defined webhook secret lifecycle, HMAC signing, idempotency key formula, and delivery retry contract for the Webhook Delivery System.
---

# Webhook Delivery Contract

## Activation
- **Method**: Model Decision
- **Files**: `apps/backend/src/services/webhooks/**/*.ts`, `apps/backend/src/workers/webhook.worker.ts`

---

## 1. Webhook Secret Lifecycle

### Registration (`POST /api/webhooks`)
1. Auto-generate a 32-byte random secret: `crypto.getRandomValues(new Uint8Array(32))` → 64-char hex string.
2. **Hash** the secret with SHA-256 before storing in `webhook_registrations.secret`.
3. Return the **raw (unhashed) secret** in the `201 Created` response under key `"secret"`. It is **never retrievable again**.

```json
{ "id": "...", "url": "...", "secret": "<64-char hex>", "createdAt": "..." }
```

---

## 2. Payload Signing (HMAC-SHA256)

When delivering a webhook, the worker **must**:
1. Retrieve the **hashed** secret from DB.
2. Recompute HMAC-SHA256 of the JSON payload using the **original raw secret** (which the tenant has stored).

> **Implementation note**: Since only the hash is stored, the worker signs with the raw secret derived at registration time. The tenant verifies using their stored copy of the raw secret.
> 
> Alternative: Store the raw secret encrypted (not just hashed) so the worker can decrypt and sign. Choose one approach and document it in `ai/docs/`.

3. Place the signature in the `X-Signature` header.

---

## 3. Idempotency Key

Every webhook delivery **must** include an `X-Idempotency-Key` header calculated as:

```
SHA-256(event_type + ":" + document_id + ":" + tenant_id + ":" + attempt_number)
```

Hex-encoded. This allows receiving systems to deduplicate retried deliveries.

---

## 4. Delivery Retry Contract

| Parameter | Value |
|---|---|
| Max attempts | 5 |
| Backoff strategy | Exponential (e.g., 1s, 2s, 4s, 8s, 16s) |
| Circuit breaker | Per webhook URL (see `circuit-breaker-contract.md`) |

- All attempts (success and failure) logged in `webhook_logs` table with: `webhook_id`, `tenant_id`, `event_type`, `status`, `attempt`, `response_code`, `error`, `idempotency_key`.
- If circuit breaker is **open**, skip delivery without consuming a retry attempt.

---

## 5. Supported Events

MVP supports only one event type: `document.ready`. The `POST /api/webhooks` request body contains only `{ url }` — no event type selection.
