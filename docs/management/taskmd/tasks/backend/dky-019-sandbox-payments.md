---
id: "dky-019"
title: "Sandbox Payment Webhook Integration"
status: completed
priority: low
effort: medium
type: feature
phase: "b2b-security"
dependencies: ["dky-003"]
tags: ["payments","webhooks"]
created_at: 2026-06-26
---

# Sandbox Payment Webhook Integration

## Objective
Integrasi Dummy Payment Gateway untuk memicu webhook pembayaran dan meng-upgrade tier tenant.

## Tasks
- [x] Create `POST /api/payments/checkout` to generate dummy links
- [x] Create `POST /api/payments/webhook` listener
- [x] Validate signature from Payment Gateway
- [x] Update `tenant_tiers` on successful payment

## Acceptance Criteria
- Valid signature upgrades tenant tier
- Invalid signature rejected with 401
