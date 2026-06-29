---
id: "dky-023"
title: "RAG Input Validation & DoS Prevention"
status: pending
priority: high
effort: small
type: feature
phase: "rag"
tags: ["security","zod","api-gateway"]
created_at: 2026-06-28
---

# RAG Input Validation & DoS Prevention

## Objective
Membatasi *input* maksimal (690 karakter) di API Gateway menggunakan Zod untuk mencegah *Prompt Injection Layer 1* dan *Token Exhaustion*.

## Tasks
- [ ] Buat skema Zod untuk input `POST /api/chat`
- [ ] Implementasikan middleware validasi di Hono API Gateway
- [ ] Return standar `400 VALIDATION_ERROR` jika karakter melebihi 690 karakter
- [ ] Tolak input yang terindikasi injeksi atau tidak wajar

## Acceptance Criteria
- Input > 690 karakter langsung ditolak sebelum mencapai LLM
- Response menggunakan standar error JSON sesuai PRD
