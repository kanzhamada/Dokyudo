---
id: "dky-013"
title: "Upstash Vector & Postgres Upsert"
status: completed
priority: high
effort: medium
type: feature
phase: "ingestion"
dependencies: ["dky-012"]
tags: ["stb","upstash","postgres"]
created_at: 2026-06-26
---

# Upstash Vector & Postgres Upsert

## Objective
Menyimpan (Upsert) vektor ke Upstash Vector dan teks asli ke Supabase FTS secara transaksional dari Worker STB.

## Tasks
- [x] Upsert embeddings to Upstash Vector using Rest API
- [x] Store raw text chunks in Supabase Postgres FTS column
- [x] Implement Idempotency (prevent duplicate embeddings if webhook retries)
- [x] Update original document `status` to 'processed'

## Acceptance Criteria
- Vectors successfully indexed in Upstash
- Repeating the exact webhook does not duplicate vectors
