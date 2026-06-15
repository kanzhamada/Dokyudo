---
trigger: model_decision
description: Enforces OAuth security constraints from PRD §5.1 and §5.5 including email verification gates, single-use state tokens, and provider token disposal for Google and GitHub OAuth flows.
---

# OAuth Security Contract

## Activation
- **Method**: Model Decision
- **Files**: `apps/backend/src/services/auth/**/*.ts`

---

## 1. State Parameter — CSRF Protection

- Generate a cryptographically random `state` value using `crypto.randomUUID()`.
- Store in Redis: `oauth:{state}` → `{provider}` with **5-minute TTL**.
- On callback: validate `state` exists in Redis. If missing/expired → `401 UNAUTHORIZED`.
- **Delete the key immediately after reading** (single-use). Never reuse a state value.

---

## 2. Email Verification Gate

The backend **MUST** only proceed with account creation or linking if the email from the provider carries `email_verified: true`.

### Google
- Read `email_verified` from the userinfo response. Reject if `false` or absent.

### GitHub  
- Check primary email's `verified` field. If `false`, fall back to `GET /user/emails`.
- Use the **first** email where `verified: true`. If none exist → reject with `401 UNAUTHORIZED`.

---

## 3. Account Linking Logic

1. If OAuth email matches an existing user → **link** the provider to that account via `oauth_providers` table.
2. If no match → **create** new user + tenant record (1:1 mapping).
3. OAuth-only accounts have `password_hash = NULL`. These accounts **cannot** log in via the email/password endpoint.

---

## 4. Provider Token Disposal

Provider access tokens (Google, GitHub) are used **only** during the callback to fetch user profile info. They are **never** stored in the database or Redis. Only the Dokyudo JWT + Redis refresh session are retained.

---

## 5. Redirect URI Security

- Redirect URIs **must** be configured as environment variables (`OAUTH_REDIRECT_BASE_URL`).
- In production, redirect URIs must be locked to known origins in both the Google Cloud Console and GitHub OAuth App settings.
- Never accept dynamic or user-supplied redirect URIs.
