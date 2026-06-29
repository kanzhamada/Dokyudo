---
id: "dky-014"
title: "Hybrid Search & Reciprocal Rank Fusion"
status: completed
priority: high
effort: large
type: feature
phase: "rag"
dependencies: ["dky-013","dky-003"]
tags: ["search","rag","rrf"]
created_at: 2026-06-26
---

# Hybrid Search & Reciprocal Rank Fusion

## Objective
Membuat endpoint `/api/search` yang paralel mengambil data dari Upstash & Supabase, lalu menggabungkan skor RRF.

## Tasks
- [x] Create `/api/search` route (requires Auth middleware)
- [x] Execute Vector Search (Upstash) and FTS (Supabase) concurrently
- [x] Enforce strict `tenant_id` filtering on both queries
- [x] Implement Reciprocal Rank Fusion scoring algorithm in memory
- [x] Hydrate Top-K IDs with full text content

## Acceptance Criteria
- Both semantic and keyword searches are executed in parallel
- Search results strictly belong to the authenticated `tenant_id`
