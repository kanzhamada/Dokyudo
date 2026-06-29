---
id: "dky-015"
title: "AI Circuit Breaker & Fallback System"
status: completed
priority: high
effort: medium
type: feature
phase: "rag"
dependencies: ["dky-014"]
tags: ["circuit-breaker","redis","llm"]
created_at: 2026-06-26
---

# AI Circuit Breaker & Fallback System

## Objective
Membangun sistem Fallback LLM (Groq -> Gemini -> Cohere) dengan Circuit Breaker Redis Pipelining.

## Tasks
- [x] Implement Circuit Breaker logic class in Deno
- [x] Store circuit state (failures, half-open) in Upstash Redis via Pipelining
- [x] Degrade gracefully to Keyword Search only if Embedding API is down

## Acceptance Criteria
- Circuit Breaker trips after X consecutive API failures
- Requests instantly fail-fast or fallback without waiting for timeouts
