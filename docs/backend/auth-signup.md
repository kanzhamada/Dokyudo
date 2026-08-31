# User Registration & Custom Email Verification (dky-004)

**Completion Timestamp:** 2026-08-28 13:25:00 UTC+7

## Core Logic

The registration flow (`POST /api/auth/register`) enforces strong password policies and authenticates humans via reCAPTCHA v3 before creating unverified users.

Instead of relying on Supabase's default redirect links, this system routes verification through custom branded frontend URLs:
1. Validates the reCAPTCHA token and performs Anti-Bot/Bruteforce rate limiting checks.
2. Checks Redis (`unverified_email:{email}`) to see if a verification email was recently sent. If yes, it aborts early and returns 400 Bad Request to save Resend quotas.
3. Calls Supabase Auth Admin API (`supabase.auth.admin.generateLink({ type: 'signup' })`) which silently creates the user in an unverified state and returns `hashed_token`.
4. Constructs a custom frontend verification URL: `${FRONTEND_URL}/auth/verify?token_hash=${hashed_token}&type=signup`.
5. Passes the custom URL, `userId`, and HTTP `requestId` to `sendVerificationEmail()`.
6. Generates a transactional HTML email and delivers it via the Resend SDK (`resend.emails.send`) with an Idempotency Key (`register-email/${userId}-${requestId}`).
7. When the user clicks the link, the SvelteKit frontend at `/auth/verify` extracts `token_hash` and `type` and submits them to `POST /api/auth/verify-email`.
8. The Deno API Gateway executes `supabase.auth.verifyOtp({ token_hash, type })`, returning active session tokens (`accessToken`, `refreshToken`) to the client, provisions tenant + user records, and dispatches the one-time welcome email via `sendWelcomeEmailOnce()`.

## Flow Diagram

```mermaid
sequenceDiagram
    participant Client as SvelteKit Frontend
    participant API as Deno API Gateway
    participant Redis as Redis Cache
    participant Supabase as Supabase Auth
    participant Resend as Resend API
    participant Inbox as User Email Inbox

    Client->>API: POST /api/auth/register
    API->>API: Validate Zod Schema & reCAPTCHA
    API->>Redis: EXISTS unverified_email:{email}
    
    alt is cached (cooling down)
        Redis-->>API: true
        API-->>Client: 400 Bad Request (Check Inbox)
    else is not cached
        API->>Supabase: admin.generateLink({ type: 'signup', email, password })
        Supabase-->>API: user_id & hashed_token
        
        API->>API: Construct frontend URL: http://localhost:5173/auth/verify?token_hash=XYZ&type=signup
        API->>Resend: resend.emails.send() (Idempotency Key: register-email/{userId}-{requestId})
        Resend-->>API: 200 OK (Email Queued)
        
        API->>Redis: SETEX unverified_email:{email} 86400 "1"
        API-->>Client: 201 Created (Check Email)
        
        Resend->>Inbox: Delivers Verification Email
        Inbox->>Client: User clicks link → visits /auth/verify?token_hash=XYZ&type=signup
        Client->>API: POST /api/auth/verify-email { tokenHash: "XYZ", type: "signup" }
        API->>Supabase: supabase.auth.verifyOtp({ token_hash: "XYZ", type: "signup" })
        Supabase-->>API: 200 OK (access_token, refresh_token)
        API->>API: provisionTenantForUser & sendWelcomeEmailOnce
        Resend-->>Inbox: Delivers Welcome Email ("Your account is ready")
        API-->>Client: 200 OK (accessToken, refreshToken, user)
        Client->>Client: sessionStore.set(data) → Redirect to /app/chat
    end
```

## File Mapping

- **[MODIFY]** `apps/backend/src/modules/auth/auth.service.ts`: Updated `registerUser` to construct custom frontend verification link and added `verifyEmail` service method with `sendWelcomeEmailOnce` dispatch.
- **[MODIFY]** `apps/backend/src/shared/utils/email.util.ts`: Updated `sendWelcomeEmailOnce` JSDoc and body text for post-verification delivery.
- **[MODIFY]** `apps/backend/src/modules/auth/auth.schema.ts`: Added `VerifyEmailBodySchema`, `VerifyEmailParams`, and `VerifyEmailResponseSchema`.
- **[MODIFY]** `apps/backend/src/modules/auth/auth.controller.ts`: Added `handleVerifyEmail` handler.
- **[MODIFY]** `apps/backend/src/modules/auth/auth.routes.ts`: Registered `POST /verify-email` endpoint OpenAPI contract.
- **[NEW]** `apps/frontend/src/routes/(auth)/auth/verify/+page.svelte`: Created verification page controller.
- **[MODIFY]** `apps/frontend/src/lib/api/auth.ts`: Added `authVerifyEmail` helper.
- **[MODIFY]** `apps/frontend/src/lib/types/auth.types.ts`: Added `VerifyEmailRequestPayload` and `VerifyEmailResponse`.
- **[MODIFY]** `api-collections/Auth/14_Verify Email.bru`: Updated Bruno collection file for `POST /api/auth/verify-email`.

## Update 2026-08-31 — Email Design System (`emailShell`)

**Completion Timestamp:** 2026-08-31 16:00 UTC+7

Semua email transaksional (`sendVerificationEmail`, `sendWelcomeEmailOnce`, `sendRecoveryEmail`, `sendShareInviteEmail`, `sendPaymentSuccessEmail`, `sendAccountDeletedEmail`) di-refactor ke layout terpusat `emailShell()` di `apps/backend/src/shared/utils/email.util.ts`:

- **Design tokens dari `apps/frontend/src/lib/assets/landing.css` + `fe-poc/DESIGN.md`:** palette `black #0E0E0E` / `offblack #1A1616` / `offwhite #FAFAFA` / `white #FFFFFF` / `orange #F04E23` (primary action) / `graphite #3E3E3E` / `gray #676767` / `warm-gray #9C9996` / `ash #D9D9D9` / `border rgba(185,185,185,0.4) → #E8E8E8`; type `display Gambetta/Reckless → Georgia` / `interface Chillax/FG Futurist → Trebuchet` / `body Plus Jakarta Sans/Ease → Helvetica`; `card 0px / control 8px / pill 9999px`.
- **Struktur email-safe:** table layout 600px, semua style inline, header dark `#0E0E0E` (wordmark + terracotta dot), kicker pill uppercase `0.14em`, `h1` 26px, divider 28×2px `#F04E23`, CTA `13px 700 #0E0E0E on #F04E23 8px`.
- **Verifikasi (`sendVerificationEmail`):** `emailShell({kicker: 'Verify your email', title: 'Confirm your address', cta: 'Verify Email Address', fallbackUrl})` — idempotency `register-email/{userId}-{requestId}`.
- **Welcome (`sendWelcomeEmailOnce`):** `kicker: 'Account ready'`, perk table 3 baris dengan check-circle `#F04E23`, CTA `Get Started → FRONTEND_URL`, idempotency `welcome-email/{userId}` + Redis NX marker `welcome_email:{userId}` 1 tahun.
- File terkait: `apps/backend/src/shared/utils/email.util.ts` (`escapeHtml`, `emailShell`), `apps/backend/src/shared/utils/email.util.test.ts` (assert `Verify Email Address` + `https://verify.me` tetap hijau).

## Connections

- **Deno API Gateway**: Exposes `POST /api/auth/verify-email`.
- **Supabase Auth**: Executes `verifyOtp` for token validation.
- **Resend API**: Dispatches branded verification emails and welcome notifications.
- **SvelteKit Frontend**: Serves `/auth/verify` controller page and manages session storage.

## Architectural Decisions

- **Post-Verification Welcome Dispatch**: The welcome email is triggered strictly after successful email verification (or first OAuth login) rather than at registration time, preventing unverified accounts from receiving "account ready" notifications.
- **Supabase Domain Isolation**: Hides raw `supabase.co` URLs from user emails to maintain consistent branding and security isolation.
- **Single-Source Session Store**: Svelte 5 `$state`-based `session.store.svelte.ts` manages token lifecycle across client-side navigation.
