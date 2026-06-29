---
id: "dky-025"
title: "Enterprise BYOK Cryptography (AES-256-GCM)"
status: pending
priority: high
effort: large
type: feature
phase: "security"
tags: ["crypto","byok","security"]
created_at: 2026-06-28
---

# Enterprise BYOK Cryptography

## Objective
Menyiapkan modul enkripsi/dekripsi Web Crypto API di Deno untuk mengelola API Key custom milik tenant secara aman.

## Tasks
- [ ] Siapkan Environment Variable untuk Master Encryption Key (MEK) 32-byte
- [ ] Buat utilitas Web Crypto API (`crypto.subtle`) untuk AES-256-GCM
- [ ] Enkripsi *custom API Key* saat tenant mengunggahnya
- [ ] Dekripsi di RAM secara instan saat dibutuhkan oleh AI API Gateway (In-Memory Decryption)
- [ ] Masking API Key untuk respons UI (e.g., `sk-...789`)

## Acceptance Criteria
- API key tidak pernah tersimpan di database sebagai plaintext
- Proses dekripsi berjalan mulus dan RAM segera di-garbage collect
