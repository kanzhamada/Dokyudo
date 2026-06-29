---
id: "dky-012"
title: "Gemini API Vector Embedding"
status: completed
priority: high
effort: medium
type: feature
phase: "ingestion"
dependencies: ["dky-011"]
tags: ["stb","gemini","embedding"]
created_at: 2026-06-26
---

# Gemini API Vector Embedding

## Objective
Melanjutkan worker STB untuk memanggil API Gemini dan mengubah text chunk menjadi vektor 768 dimensi.

## Tasks
- [x] Integrate `google-genai` Python SDK for embeddings
- [x] Iterate over chunks and generate vectors sequentially (rate limit protection)
- [x] Format output array for Upsert operation

## Acceptance Criteria
- Successfully returns 768-dim float arrays for all text chunks
- Handles 429 API Rate Limit with exponential backoff
