---
id: "dky-023"
title: "RAG Input Validation & DoS Prevention"
status: completed
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
- [x] Buat skema Zod untuk input `POST /api/chat`
- [x] Implementasikan middleware validasi di Hono API Gateway
- [x] Return standar `400 VALIDATION_ERROR` jika karakter melebihi 690 karakter
- [x] Tolak input yang terindikasi injeksi atau tidak wajar

## Acceptance Criteria
- Input > 690 karakter langsung ditolak sebelum mencapai LLM
- Response menggunakan standar error JSON sesuai PRD
