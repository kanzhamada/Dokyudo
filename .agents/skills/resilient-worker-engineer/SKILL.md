---
name: resilient-worker-engineer
description: Best practices for building robust, retry-safe asynchronous background workers using BullMQ in Deno.
---

# Resilient Background Worker Skill

Use this skill when implementing the Embedding Worker, Webhook Worker, or Notification Worker defined in the PRD.

## 1. Idempotency First
Background jobs will fail and be retried. Your worker logic must be **idempotent**. 
- If the Embedding Worker retries, it must use an `INSERT ... ON CONFLICT DO UPDATE` (upsert) to ensure chunks are not duplicated in pgvector.
- Do not increment counters or deduct quotas inside the worker unless wrapped in a strict database transaction.

## 2. Dead Letter Queue (DLQ) & Error Preservation
When throwing errors inside the worker, always attach structured metadata so BullMQ can log the exact failure reason in the DLQ. Never swallow errors silently with `console.log`.

## 3. Webhook Delivery Constraints
When writing the Webhook Worker:
- Calculate the HMAC-SHA256 signature using the tenant's secret.
- Inject the `X-Signature` and `X-Idempotency-Key` headers.
- Respect external Circuit Breaker state before attempting the HTTP POST to the tenant's endpoint.