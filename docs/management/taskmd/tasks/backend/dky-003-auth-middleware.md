---
id: "dky-003"
title: "JWT Validation & Tenant Context Middleware"
status: "completed"
priority: high
effort: small
type: feature
phase: "auth-identity"
dependencies: ["dky-001"]
tags: ["auth","middleware","tenant"]
created_at: 2026-06-26
---

# JWT Validation & Tenant Context Middleware

## Objective
Implementasi middleware untuk memvalidasi JWT Supabase dan menginjeksi `tenant_id` ke dalam Hono Context.

## Tasks
- [x] Create JWT validation middleware parsing Authorization header
- [x] Verify JWT signature using Supabase secret
- [x] Extract `tenant_id` from claims and inject into `c.set('tenantId', id)`
- [x] Handle missing/invalid tokens with standardized 401 response

## Acceptance Criteria
- Requests without Bearer token return 401
- Valid requests populate `c.get('tenantId')`
- Expired tokens return 401 with specific error message
