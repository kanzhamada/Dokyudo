---
id: "dky-016"
title: "SSE Streaming RAG Chat Service"
status: completed
priority: high
effort: large
type: feature
phase: "rag"
dependencies: ["dky-015"]
tags: ["rag","sse","streaming"]
created_at: 2026-06-26
---

# SSE Streaming RAG Chat Service

## Objective
Membuat endpoint `/api/chat` dengan Prompt Engineering, RAG Context, dan Server-Sent Events (SSE) tanpa buffering.

## Tasks
- [x] Construct Augmented Prompt using context retrieved from `dky-014`
- [x] Call AI API Gateway (`dky-015`) with prompt
- [x] Set up SSE headers (`text/event-stream`, `keep-alive`)
- [x] Stream tokens to client directly via `ReadableStream`
- [x] Implement Defensive JSON parsing for metadata

## Acceptance Criteria
- Tokens stream to client without buffering delays
- Malformed JSON from truncated LLM outputs does not crash stream
