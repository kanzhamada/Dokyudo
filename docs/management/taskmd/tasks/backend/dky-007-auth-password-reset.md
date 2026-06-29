---
id: "dky-007"
title: "Forget & Update Password"
status: completed
priority: medium
effort: small
type: feature
phase: "auth-identity"
dependencies: ["dky-001"]
tags: ["auth","security","recovery"]
created_at: 2026-06-26
---

# Forget & Update Password

## Objective
Endpoint untuk memulihkan kata sandi yang lupa dan memperbarui kata sandi secara mandiri.

## Tasks
- [x] Create `POST /api/auth/forget-password` to trigger OTP/Magic Link
- [x] Create `POST /api/auth/reset-password` to accept OTP and new password
- [x] Create protected `PUT /api/auth/update-password` for authenticated users

## Acceptance Criteria
- Forget password sends recovery email via Resend
- Update password requires re-authentication or valid JWT
