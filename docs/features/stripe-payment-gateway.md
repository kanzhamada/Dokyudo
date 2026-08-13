# Stripe Payment Gateway Documentation

**Completion Timestamp**: 2026-07-31T16:43:00+07:00 (WIB)

## Core Logic

The Stripe Payment Gateway integration handles tier upgrades, subscriptions, and single purchases within Dokyudo. It utilizes a **Hybrid Architecture**:
1. **One-Time Purchase (`payment` mode)**: Used for `SIMULATE` (24-hour expiration) and `OIL_INVESTOR` (Lifetime access) tiers.
2. **Recurring Subscription (`subscription` mode)**: Used for the `PRO` monthly subscription tier.

Pricing and currencies are managed directly within the Stripe Dashboard (`price_id`), ensuring the backend never hardcodes transaction amounts. Upon successful or failed transactions, the service emits audit entries into `activity_logs` (`billing.payment_completed` or `billing.payment_failed`) enriched with `clientIp`, `userAgent`, and `requestId` extracted via `ContextExtractor.extractAuditContext()`.

---

## Flow Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User as Client / User
    participant Frontend as SvelteKit UI
    participant Backend as Dokyudo API
    participant Extractor as ContextExtractor
    participant DB as PostgreSQL
    participant Stripe as Stripe API

    User->>Frontend: Click "Upgrade Tier"
    Frontend->>Backend: POST /api/payments/checkout { tierToUnlock }
    Backend->>Extractor: extractAuditContext(c)
    Extractor-->>Backend: { clientIp, userAgent, requestId }
    
    Backend->>DB: Query Tenant & tenantSubscriptions
    Backend->>Stripe: POST /v1/checkout/sessions (Price ID)
    Stripe-->>Backend: Return JSON (Session ID, url)
    Backend->>DB: Insert payment_transactions (SUCCEEDED / PENDING)
    Backend-->>Frontend: Return checkoutUrl
    Frontend-->>User: Redirect to Stripe Checkout

    Note over User,Stripe: User completes or cancels payment...

    Stripe->>Backend: POST /api/payments/webhook
    Note over Stripe,Backend: Event: checkout.session.completed OR payment_failed
    Backend->>Backend: Verify Webhook Signature (Stripe-Signature)
    
    alt Checkout Succeeded
        Backend->>DB: Update payment_transactions status to SUCCEEDED
        Backend->>DB: Upsert tenant_subscriptions (New Tier)
        Backend->>DB: INSERT INTO activity_logs (billing.payment_completed)
        Backend->>Resend: Send payment success email (summary)
    else Payment Failed / Expired
        Backend->>DB: Update payment_transactions status to FAILED
        Backend->>DB: INSERT INTO activity_logs (billing.payment_failed)
    end
    
    Backend-->>Stripe: 200 OK

    Note over User,Backend: Browser lands on /app/billing/success?session_id=...
    User->>Backend: POST /api/payments/checkout/verify { sessionId }
    Backend->>Stripe: GET /v1/checkout/sessions/{id}
    alt Session owned by tenant AND paid
        Backend-->>Frontend: { valid: true, status: "paid", tier }
        Frontend-->>User: Success state + confetti + countdown
    else Foreign / unknown session
        Backend-->>Frontend: 404 (generic, no tenant leak)
        Frontend-->>User: Error state
    end
```

---

## File Mapping

- **Database Models**: 
  - `apps/backend/src/shared/models/db.model.ts` (`tenant_subscriptions`, `payment_transactions`, `activity_logs`, `tierEnum`: `FREE`, `SIMULATE`, `OIL_INVESTOR`, `PRO`, `paymentStatusEnum`: `PENDING`, `SUCCEEDED`, `FAILED`, `CANCELED`, `EXPIRED`).
- **Configuration**:
  - `apps/backend/src/config/stripe.ts` (Stripe instance initialization).
  - `apps/backend/src/config/env.ts` (`STRIPE_SECRET_KEY` & `STRIPE_WEBHOOK_SECRET` validation).
- **Payments Module** (`apps/backend/src/modules/payments/`):
  - `payments.schema.ts` (Zod schemas untuk checkout, portal, dan verifikasi session).
  - `payments.service.ts` (Dynamic checkout sessions, webhook handlers untuk `checkout.session.completed`, `checkout.session.async_payment_failed`, `invoice.payment_failed`, verifikasi session `verifyCheckoutSession`, notifikasi email `sendPaymentSuccessNotification`, dan audit log emissions).
  - `payments.controller.ts` (Context extraction via `ContextExtractor.extractAuditContext()`, JWT validation, dan Stripe signature verification).
  - `payments.routes.ts` (OpenAPI endpoint definitions: `/checkout`, `/webhook`, `/portal`, `/checkout/verify`).
- **Email Notifications** (`apps/backend/src/shared/utils/email.util.ts`): `sendVerificationEmail`, `sendRecoveryEmail`, `sendShareInviteEmail`, `sendPaymentSuccessEmail`.

---

## Update 2026-08-12 — Webhook Fulfillment Fix & Payment Success Page

**Bug**: transaksi tetap `PENDING` meskipun pembayaran berhasil. Handler `checkout.session.completed` mensyaratkan `tenantId`, `externalId`, `tierToUnlock` di `session.metadata`, tetapi saat create checkout `externalId` hanya dikirim via `client_reference_id` dan **tidak dimasukkan ke metadata** → handler selalu `break` di "Missing metadata" (log `webhookWarning`), transaksi tidak pernah di-mark `SUCCEEDED`, tier tidak ter-upgrade.

**Fix** (`apps/backend/src/modules/payments/payments.service.ts`):
1. `metadata` saat `checkout.sessions.create` kini menyertakan `externalId` (selain `tenantId` + `tierToUnlock`).
2. Handler webhook punya fallback `session.metadata?.externalId ?? session.client_reference_id` untuk resiliensi (mis. fixture test tanpa metadata).
3. Catatan: event dari `stripe trigger checkout.session.completed` (fixture) memang tanpa metadata maupun `client_reference_id`, jadi warning "Missing metadata" tetap wajar muncul untuk fixture — uji E2E pakai checkout asli lewat dashboard.

**Alur halaman sukses** (`apps/frontend/src/routes/dashboard/billing/success/+page.svelte` — sebelum dipindah ke `/app` pada 2026-08-13):
1. Membaca `session_id` dari URL, menampilkan state `Confirming payment`.
2. Polling `GET /api/me/usage` (maks 5× dengan jeda) sampai webhook Stripe sempat meng-update tier.
3. Menampilkan `Payment successful` + tier aktif, countdown redirect ~5 detik.
4. Redirect ke `/app?billing=open` → `AppSidebar` membuka `AccountPanelDialog` langsung di tab `billing` (via `account-panel.store`).

**Perubahan lain**:
- `return_url` portal Stripe diubah dari `/dashboard/billing` → **`/app/dashboard`** (rute app yang benar).
- Frontend: `lib/api/payments.ts` menambah `createCheckoutSession({ tierToUnlock })` dan `createBillingPortalSession()`; tipe `CheckoutResponse`/`BillingPortalResponse` di `lib/types/payments.types.ts`.
- UI Billing ada di `AccountPanelDialog.svelte` (tab `billing`): usage dengan limit (`TIER_LIMITS`), countdown reset bulanan (FREE), `expiresAt` (non-FREE) + `Manage billing`, pricing plans (`TIER_PLANS`), tombol `Access Sandbox` → `POST /api/payments/checkout { tierToUnlock: "SIMULATE" }` lalu redirect ke Stripe Checkout.

---

## Update 2026-08-13 — Session Verification & Payment Success Email

**Keamanan halaman success** (tiga lapis):
1. **Route guard**: halaman dipindah ke `apps/frontend/src/routes/app/billing/success/` — guard existing `/app/+layout.ts` (cek `dokyudo_session` di localStorage) memblokir akses tanpa login. Direktori `routes/dashboard/` dihapus.
2. **Verifikasi session server-side**: endpoint baru `POST /api/payments/checkout/verify` (`apps/backend/src/modules/payments/`):
   - Zod: `sessionId` wajib berformat `cs_*`.
   - `stripe.checkout.sessions.retrieve(sessionId)` dengan secret key; error apa pun → 404 generik "Unable to verify payment session" (tidak membocorkan apakah session milik tenant lain).
   - Binding: `session.metadata.tenantId` harus sama dengan `tenantId` dari JWT; fallback ke baris `payment_transactions` (by `stripe_session_id`) untuk session lama tanpa metadata.
   - Response `{ valid, status, tier }`; hanya menentukan state UI — **provisioning tier tetap satu-satunya tugas webhook** yang signature-verified.
3. **Hapus fallback palsu**: loop polling `getMeUsage` 5× yang menetapkan `success` tanpa syarat dihapus. User login mana pun tidak bisa lagi memalsukan halaman sukses dengan `session_id` acak.

**Email notifikasi pembayaran** (`apps/backend/src/shared/utils/email.util.ts` → `sendPaymentSuccessEmail`):
- Dipicu dari webhook `checkout.session.completed` (jalur provisioning terverifikasi), satu email per session (`idempotencyKey: payment-success/{externalId}`).
- Dari `Dokyudo <team@dokyudo.my.id>`, subject `Payment successful - {Plan} - Dokyudo`.
- Isi: heading + summary box (Plan purchased / Amount paid / Date / Status Active) + CTA "Open Dokyudo" → `/app?billing=open`.
- Amount mengikuti aturan minor unit Stripe: currency zero-decimal (IDR, JPY, VND, ...) tidak dibagi 100; sisanya dibagi 100; fallback aman untuk currency tak dikenal. Plan name di-escape HTML.
- Penerima: email user pemilik tenant (user pertama `users` by `tenantId`).
- **Best-effort by design**: kegagalan email hanya di-log (`emailError` di logContext), tidak pernah menggagalkan ack webhook.

**Kontrak API baru**:
- `POST /api/payments/checkout/verify` — body `{ sessionId }`, response `{ valid, status, tier }`, error 400/401/404.
- `success_url` checkout diubah ke `${FRONTEND_URL}/app/billing/success?session_id={CHECKOUT_SESSION_ID}`; `cancel_url` diselaraskan ke `/app?billing=open` (sebelumnya menunjuk route yang tidak pernah ada).

**File Mapping tambahan**:
- `apps/backend/src/modules/payments/payments.schema.ts` — `VerifyCheckoutSessionBodySchema` + response/params schemas.
- `apps/backend/src/modules/payments/payments.service.ts` — `verifyCheckoutSession`, `sendPaymentSuccessNotification`, `TIER_LABELS`.
- `apps/backend/src/modules/payments/payments.controller.ts` — `handleVerifyCheckoutSession`.
- `apps/backend/src/modules/payments/payments.routes.ts` — `POST /checkout/verify`.
- `apps/backend/src/shared/utils/email.util.ts` — `sendPaymentSuccessEmail`.
- `apps/frontend/src/lib/api/payments.ts` + `lib/types/payments.types.ts` — `verifyCheckoutSession`.
- `apps/frontend/src/routes/app/billing/success/+page.svelte` — alur verify-first (confirming → success / syncing / error).
- Koleksi Bruno: `api-collections/Payments & Subscriptions/04_Verify Checkout Session.bru`.

---

## Connections

- **Database**: Separated between `payment_transactions` (immutable transaction ledger) and `tenant_subscriptions` (current active tier state).
- **Stripe API**: Connected via official `stripe-node` SDK using dashboard-configured `price_id` references.
- **Audit Logging**: Webhook and checkout handlers extract `clientIp` and `userAgent` metadata to record `billing.payment_completed` or `billing.payment_failed` activity logs.

---

## Architectural Decisions

1. **Hybrid Checkout Modes**: Separates `payment` and `subscription` modes so Stripe does not reject one-time purchase attempts.
2. **Dashboard-Driven Pricing**: Amounts and currency codes are read directly from Stripe event payloads (`amount_total`, `currency`) and saved into database records and activity log metadata.
3. **Resilient Status Tracking**: `paymentTransactions.status` enum strictly uses `"PENDING" | "SUCCEEDED" | "FAILED" | "CANCELED" | "EXPIRED"`.
4. **Audit Context Extraction**: Webhook and portal controllers call `ContextExtractor.extractAuditContext()` to attach IP and client user-agent metadata to billing logs.
