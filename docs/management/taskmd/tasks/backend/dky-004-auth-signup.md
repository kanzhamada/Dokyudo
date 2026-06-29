---
id: "dky-004"
title: "User Registration & Email Verification"
status: "completed"
priority: high
effort: medium
type: feature
phase: "auth-identity"
dependencies: ["dky-001"]
tags: ["auth","supabase","email"]
created_at: 2026-06-26
---

# User Registration & Email Verification

## Objective
Membuat endpoint registrasi pengguna dengan verifikasi reCAPTCHA dan pengiriman email konfirmasi.

## Tasks
- [x] Create `POST /api/auth/register` endpoint
- [x] Validate reCAPTCHA token
- [x] Enforce strong password policy via Zod schema
- [x] Register user in Supabase Auth via Admin API
- [x] Trigger Supabase email verification flow (via Resend)

## Acceptance Criteria
- Valid registration creates unverified user in Supabase
- Weak passwords fail validation with 400 Bad Request
- Missing or invalid reCAPTCHA returns 400
