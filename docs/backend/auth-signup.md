# User Registration & Custom Email Verification (dky-004)

**Completion Timestamp:** 2026-07-23 11:05:00 UTC+7

## Core Logic

The registration flow (`POST /api/auth/register`) enforces strong password policies and authenticates humans via reCAPTCHA v3 before provisioning users.

Instead of relying on Supabase's default redirect links, this system routes verification through custom branded frontend URLs:
1. Validates the reCAPTCHA token and performs Anti-Bot/Bruteforce rate limiting checks.
2. Checks Redis (`unverified_email:{email}`) to see if a verification email was recently sent. If yes, it aborts early and returns 400 Bad Request to save Resend quotas.
3. Calls Supabase Auth Admin API (`supabase.auth.admin.generateLink({ type: 'signup' })`) which silently creates the user in an unverified state and returns `hashed_token`.
4. Constructs a custom frontend verification URL: `${FRONTEND_URL}/auth/verify?token_hash=${hashed_token}&type=signup`.
5. Passes the custom URL, `userId`, and HTTP `requestId` to `sendVerificationEmail()`.
6. Generates a transactional HTML email and delivers it via the Resend SDK (`resend.emails.send`) with an Idempotency Key (`register-email/${userId}-${requestId}`).
7. When the user clicks the link, the SvelteKit frontend at `/auth/verify` extracts `token_hash` and `type` and submits them to `POST /api/auth/verify-email`.
8. The Deno API Gateway executes `supabase.auth.verifyOtp({ token_hash, type })`, returning active session tokens (`accessToken`, `refreshToken`) to the client, which stores them in `sessionStore` and redirects to `/app/chat`.

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
        API-->>Client: 200 OK (accessToken, refreshToken, user)
        Client->>Client: sessionStore.set(data) → Redirect to /app/chat
    end
```

## File Mapping

- **[MODIFY]** `apps/backend/src/modules/auth/auth.service.ts`: Updated `registerUser` to construct custom frontend verification link and added `verifyEmail` service method.
- **[MODIFY]** `apps/backend/src/modules/auth/auth.schema.ts`: Added `VerifyEmailBodySchema`, `VerifyEmailParams`, and `VerifyEmailResponseSchema`.
- **[MODIFY]** `apps/backend/src/modules/auth/auth.controller.ts`: Added `handleVerifyEmail` handler.
- **[MODIFY]** `apps/backend/src/modules/auth/auth.routes.ts`: Registered `POST /verify-email` endpoint OpenAPI contract.
- **[NEW]** `apps/frontend/src/routes/(auth)/auth/verify/+page.svelte`: Created verification page controller.
- **[MODIFY]** `apps/frontend/src/lib/api/auth.ts`: Added `authVerifyEmail` helper.
- **[MODIFY]** `apps/frontend/src/lib/types/auth.types.ts`: Added `VerifyEmailRequestPayload` and `VerifyEmailResponse`.
- **[NEW]** `api-collections/Auth/14_Verify Email.bru`: Created Bruno collection file for `POST /api/auth/verify-email`.

## Connections

- **Deno API Gateway**: Exposes `POST /api/auth/verify-email`.
- **Supabase Auth**: Executes `verifyOtp` for token validation.
- **Resend API**: Dispatches branded verification emails containing custom frontend links.
- **SvelteKit Frontend**: Serves `/auth/verify` controller page and manages session storage.

## Architectural Decisions

- **Supabase Domain Isolation**: Hides raw `supabase.co` URLs from user emails to maintain consistent branding and security isolation.
- **Single-Source Session Store**: Svelte 5 `$state`-based `session.store.svelte.ts` manages token lifecycle across client-side navigation.
