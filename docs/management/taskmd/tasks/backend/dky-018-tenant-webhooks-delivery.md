---
id: "dky-018"
title: "Webhook HMAC Delivery Worker"
status: pending
priority: high
effort: large
type: feature
phase: "b2b-security"
dependencies: ["dky-017"]
tags: ["webhooks","hmac","worker"]
created_at: 2026-06-26
---

# Webhook HMAC Delivery Worker

## Objective
Sistem pengiriman webhook ke klien dengan generate `X-Signature` HMAC-SHA256 dan antrean QStash.

## Tasks
- [ ] Setup QStash queue for outgoing webhooks
- [ ] Worker pulls event, decrypts tenant secret
- [ ] Generate HMAC-SHA256 signature for payload
- [ ] Send HTTP POST to tenant's URL with `X-Signature` header
- [ ] Implement exponential backoff retry

## Acceptance Criteria
- Tenant receives exact JSON payload with correct cryptographic signature
- Failed deliveries are retried automatically
