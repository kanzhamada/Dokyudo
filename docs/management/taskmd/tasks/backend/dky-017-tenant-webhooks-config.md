---
id: "dky-017"
title: "Tenant Webhook MEK Encryption"
status: pending
priority: medium
effort: medium
type: feature
phase: "b2b-security"
dependencies: ["dky-003"]
tags: ["webhooks","crypto","config"]
created_at: 2026-06-26
---

# Tenant Webhook MEK Encryption

## Objective
Endpoint konfigurasi webhook penyewa yang mengamankan secret key dengan enkripsi AES-256-GCM (MEK).

## Tasks
- [ ] Generate Master Encryption Key (MEK)
- [ ] Create `POST /api/webhooks/config` endpoint
- [ ] Encrypt incoming webhook secret using AES-256-GCM before saving to DB

## Acceptance Criteria
- Webhook secrets are stored as encrypted blobs, never plaintext
- Can decrypt secrets successfully with MEK
