---
id: "dky-011"
title: "STB Text Extraction & Chunking"
status: completed
priority: high
effort: medium
type: feature
phase: "ingestion"
dependencies: ["dky-010"]
tags: ["stb","pdf","worker"]
created_at: 2026-06-26
---

# STB Text Extraction & Chunking

## Objective
Membangun worker STB yang menerima webhook, mengunduh PDF dari MinIO, dan memotong teks (Finance Chunking).

## Tasks
- [x] Create lightweight local HTTP server to receive Supabase webhook
- [x] Download PDF from local MinIO instance
- [x] Extract text from PDF while handling memory limits
- [x] Implement chunking algorithm (1000 tokens, 150 overlap)

## Acceptance Criteria
- Worker successfully processes a 50-page PDF sequentially
- Worker does not exceed STB memory constraints
