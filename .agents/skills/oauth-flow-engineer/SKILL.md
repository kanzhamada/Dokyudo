---
name: oauth-flow-engineer
description: Delegates to this agent when implementing OAuth login flows (Google OIDC, GitHub OAuth) in the Deno + Hono backend, including state management, code exchange, userinfo fetch, account linking, and JWT issuance.
---

# OAuth Flow Engineer Skill

Use this skill when building or modifying the OAuth authentication flows defined in PRD §5.1 and §5.5 (Sprint 2 tasks F1.6, F1.7, F1.8).

## When to Use
- Implementing `GET /api/auth/oauth/:provider` redirect endpoint.
- Implementing `GET /api/auth/oauth/:provider/callback` handler.
- Building the `oauth_providers` table and account-linking logic.
- Debugging OAuth state validation, token exchange, or email verification issues.

---

## 1. Redirect Endpoint Pattern

```typescript
// GET /api/auth/oauth/google
app.get("/api/auth/oauth/google", async (c) => {
  const state = crypto.randomUUID();
  await redis.set(RedisKeys.oauthState(state), "google", "EX", 300);

  const params = new URLSearchParams({
    client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
    redirect_uri: `${Deno.env.get("OAUTH_REDIRECT_BASE_URL")}/api/auth/oauth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
  });

  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});
```

---

## 2. Callback Handler Pattern

The callback must execute these steps **in strict order**:

1. **Validate state** — Read from Redis, delete immediately (single-use).
2. **Exchange code for tokens** — POST to provider's token endpoint.
3. **Fetch user profile** — GET userinfo (Google) or user + emails (GitHub).
4. **Apply email verification gate** — Reject if `email_verified !== true`.
5. **Upsert user + tenant** — Link provider if email exists, else create new records.
6. **Issue Dokyudo session** — JWT (15min) + Redis refresh session (24h).
7. **Redirect to app** — `302` to `/app/dashboard`.

---

## 3. GitHub Email Fallback

GitHub users can hide their email. The flow must handle this:

```typescript
// Step 1: Try primary profile email
const userRes = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${accessToken}` } });
const profile = await userRes.json();

let email = profile.email;
let emailVerified = true; // GitHub primary email is implicitly verified if public

// Step 2: Fallback to /user/emails if no public email
if (!email) {
  const emailsRes = await fetch("https://api.github.com/user/emails", { headers: { Authorization: `Bearer ${accessToken}` } });
  const emails = await emailsRes.json();
  const verified = emails.find((e: any) => e.verified === true);
  if (!verified) throw new AppError({ code: "UNAUTHORIZED", message: "No verified email found", status: 401 });
  email = verified.email;
}
```

---

## 4. Account Linking vs Creation

```typescript
const existingUser = await db.select().from(users).where(
  and(eq(users.email, email), eq(users.tenant_id, tenantContext.tenantId))
).limit(1);

if (existingUser.length > 0) {
  // Link provider to existing account
  await db.insert(oauthProviders).values({
    id: crypto.randomUUID(),
    userId: existingUser[0].id,
    provider: "google",
    providerUserId: providerProfile.sub,
  }).onConflictDoNothing(); // Idempotent linking
} else {
  // Create new user + tenant (1:1)
  // ... insert into tenants, then users, then oauth_providers
}
```

---

## 5. Security Checklist

- [ ] `state` stored in Redis with 5-min TTL, deleted on first read
- [ ] Email verification gate applied for both Google and GitHub
- [ ] Provider access tokens **not** stored after callback
- [ ] `oauth_providers` table enforces unique `(provider, provider_user_id)`
- [ ] OAuth-only accounts have `password_hash = NULL`
- [ ] Redirect URI comes from env var, never from query params
