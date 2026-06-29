---
id: "dky-016"
title: "SSE Streaming RAG Chat Service"
status: pending
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
- [ ] Construct Augmented Prompt using context retrieved from `dky-014`
- [ ] Call AI API Gateway (`dky-015`) with prompt
- [ ] Set up SSE headers (`text/event-stream`, `keep-alive`)
- [ ] Stream tokens to client directly via `ReadableStream`
- [ ] Implement Defensive JSON parsing for metadata

## Acceptance Criteria
- Tokens stream to client without buffering delays
- Malformed JSON from truncated LLM outputs does not crash stream
