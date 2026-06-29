---
id: "dky-002"
title: "Global Rate Limiting & Anomaly Detection"
status: "completed"
priority: high
effort: medium
type: feature
phase: "core-infra"
dependencies: ["dky-001"]
tags: ["redis","security","upstash"]
created_at: 2026-06-26
---

# Global Rate Limiting & Anomaly Detection

## Objective
Implementasi Rate Limiter dan Anomaly Detection berbasis IP/User-Agent menggunakan Upstash Redis.

## Tasks
- [x] Integrate `@upstash/ratelimit` into Hono middleware
- [x] Implement IP-based Sliding Window rate limiting
- [x] Implement User-Agent anomaly detection (blocking suspicious bots)
- [x] Set up dynamic rate limit penalty for repeated 400/401 errors

## Acceptance Criteria
- Clients exceeding limits receive 429 Too Many Requests
- Anomaly detection dynamically lowers limits for suspicious User-Agents
