---
id: "dky-006"
title: "OAuth 2.0 (Google/GitHub) Integration"
status: "completed"
priority: medium
effort: medium
type: feature
phase: "auth-identity"
dependencies: ["dky-001"]
tags: ["auth","oauth","sso"]
created_at: 2026-06-26
---

# OAuth 2.0 (Google/GitHub) Integration

## Objective
Integrasi Supabase OAuth callback untuk mendukung pendaftaran dan login via Google dan GitHub.

## Tasks
- [x] Create `GET /api/auth/oauth/google` redirect endpoint
- [x] Create `GET /api/auth/oauth/github` redirect endpoint
- [x] Handle OAuth callback and session exchange
- [x] Automatically provision `tenant_id` for new OAuth users

## Acceptance Criteria
- OAuth callback successfully issues JWT session
- New OAuth users receive a default tenant organization
