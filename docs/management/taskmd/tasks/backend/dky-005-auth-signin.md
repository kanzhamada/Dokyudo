---
id: "dky-005"
title: "User Login & Session Issuance"
status: "completed"
priority: high
effort: medium
type: feature
phase: "auth-identity"
dependencies: ["dky-001"]
tags: ["auth","security","session"]
created_at: 2026-06-26
---

# User Login & Session Issuance

## Objective
Membuat endpoint login dengan perlindungan anti-bruteforce (Password Spraying) dan penerbitan JWT.

## Tasks
- [x] Create `POST /api/auth/login` endpoint
- [x] Authenticate user against Supabase Auth
- [x] Implement account lockout after 5 failed attempts (Redis)
- [x] Return Access and Refresh tokens on success
- [x] Create `POST /api/auth/logout` endpoint

## Acceptance Criteria
- Successful login returns valid JWT payload
- 5 failed attempts temporarily lock the email address (429)
- Logout successfully invalidates the session
