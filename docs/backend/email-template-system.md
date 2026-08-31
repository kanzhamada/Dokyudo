# Email Template System — Dokyudo Design Tokens

**Completion Timestamp:** 2026-08-31 16:30 UTC+7  
**Commit:** `c8ef73a` — *Add email design system and rewrite landing demo as chat UI*

## Core Logic

Seluruh email transaksional Dokyudo (`apps/backend/src/shared/utils/email.util.ts`) kini di-render melalui helper terpusat `emailShell()` yang mengimplementasikan design tokens dari `apps/frontend/src/lib/assets/landing.css` dan kontrak `fe-poc/DESIGN.md`. Template lama berbasis `div` generik + hex acak (`#DB8F5E`, `#1F1E1D`) diganti layout **table-based, inline-style, 600px** yang aman untuk Outlook/Gmail/Apple Mail.

### Design tokens (landing.css → email hex)

| Token | landing.css (oklch) | Email hex | Pemakaian |
|---|---|---|---|
| `black` | `oklch(17.5% 0.01 65)` | `#0E0E0E` | Header dark, teks judul, CTA text |
| `offblack` | `oklch(26% 0.02 68)` | `#1A1616` | Header border |
| `offwhite` | `oklch(94.5% 0.014 85)` | `#FAFAFA` | Body bg, card muted, fallback box |
| `white` | `oklch(98.3% 0.005 87)` | `#FFFFFF` | Card utama |
| `orange / terracotta` | `oklch(67.4% 0.15 52)` | `#F04E23` | Primary CTA, dot wordmark, divider 28×2px |
| `graphite` | `oklch(38% 0.028 66)` | `#3E3E3E` | Intro copy |
| `gray` | `oklch(54.4% 0.033 66)` | `#676767` | Body secondary |
| `warm-gray` | `oklch(69.8% 0.03 68)` | `#9C9996` | Kicker secondary, footer, label |
| `ash / gray-light` | `oklch(91.7% 0.017 71)` | `#E8E8E8` (`rgba(185,185,185,0.4)` fallback) | Border card/fallback |
| `lime` | `oklch(76% 0.07 128)` | `#E0E07B` | Badge `Active` (payment) |

Type: `display Gambetta/Reckless → Georgia` (header/h1, `tracking -0.02em`), `interface Chillax/FG Futurist → Trebuchet` (kicker `10px 500 0.14em uppercase`), `body Plus Jakarta Sans/Ease → Helvetica` (copy `14px/1.6`). Shape: `card 0px`, `control 8px`, `pill 9999px` (DESIGN.md).

### Shell `emailShell()` (`email.util.ts:16`)

```ts
function emailShell(params: {
  preheader: string;  // hidden preview text (escaped)
  kicker: string;     // pill uppercase #F04E23 on #FFF3EE
  title: string;      // h1 26px Gambetta
  introHtml: string;  // 14px #3E3E3E (boleh HTML strong)
  bodyHtml?: string;  // blok opsional (table/card)
  cta?: { label: string; url: string } // CTA #F04E23 bg, #0E0E0E text, 8px
  fallbackUrl?: string // box FAFAFA + link #F04E23 break-all
  footerNote?: string // 12px #9C9996
}): string
```

Struktur HTML (email-safe):

- `<!DOCTYPE html><html lang="en">` + `<meta color-scheme: light>` + hidden `preheader`.
- Outer `table 100% bg #FAFAFA` → inner `table 600px`.
- **Header:** `bg #0E0E0E 18px 28px` — wordmark `Gambetta 18px 500 -0.02em #FAFAFA` + dot `#F04E23 7px`, tag `9px 500 0.14em rgba(250,250,250,0.6) Secure · Document Intelligence`.
- **Card:** `bg #FFFFFF border #E8E8E8 28px` — kicker pill `FFF3EE / FCDACF`, `h1 26px`, divider `28×2 #F04E23`, `intro 14px`, `bodyHtml`, CTA table (`13px 700`), fallback box, footerNote.
- **Footer:** `11px #9C9996` `Dokyudo · dokyudo.my.id` + `10px #B9B9B9 do-not-reply`.

Semua link di-escape via `escapeHtml()` (definisi dipindah ke atas `emailShell` untuk hoisting), CTA `url` **tidak** di-escape agar `&` query tetap valid (hanya `label` di-escape).

## Email-by-email mapping

| Fungsi | Kicker / Title | Body khusus | CTA | Idempotency |
|---|---|---|---|---|
| `sendVerificationEmail` | `Verify your email / Confirm your address` | — | `Verify Email Address → actionLink` | `register-email/{userId}-{requestId}` |
| `sendWelcomeEmailOnce` | `Account ready / Welcome to Dokyudo` | Perk table 3 baris (✓ circle `#F04E23`) | `Get Started → FRONTEND_URL` | `welcome-email/{userId}` + Redis `welcome_email:{userId}` NX 1y |
| `sendRecoveryEmail` | `Password reset / Reset your password` | OTP block `FAFAFA` (`28px 700 6px`, divider, expiry) | `Reset Password via Link` | `recovery-email/{email}-{requestId}` |
| `sendShareInviteEmail` | `Shared conversation / You have been invited...` | Card `FAFAFA border-left #F04E23` (title + expiry uppercase) | `View Conversation → shareUrl` | `share-invite/{code}/{email}` |
| `sendPaymentSuccessEmail` | `Payment confirmed / Payment successful` | Table `FAFAFA` (Plan / Amount / Date / pill `Active` `#E0E07B`) | `Open Dokyudo → dashboardUrl` | `payment-success/{externalId}` |
| `sendAccountDeletedEmail` | `Account deleted / Account successfully deleted` | Reference card mono `jobId` + divider + email inline | — | `account-deleted/{jobId}` |

Zero-decimal currency handling (IDR/JPY/…) tidak dibagi 100; fallback `Intl.NumberFormat("id-ID")` aman.

## File Mapping

- **[MODIFY]** `apps/backend/src/shared/utils/email.util.ts` — `escapeHtml` (hoisted), `emailShell`, 6 template rewrite (CTA `Get Started`, `Verify Email Address`, `Reset Password via Link`, `View Conversation`, `Open Dokyudo` tetap ada untuk `email.util.test.ts` assert).
- `apps/backend/src/shared/utils/email.util.test.ts` — assert `google` / `Get Started` / `https://verify.me` / `123456` / `Rp 58.000,00` / `Aug 13, 2026` tetap hijau.
- `apps/frontend/src/lib/assets/landing.css:1` — sumber token; `fe-poc/DESIGN.md` — kontrak hex.
- Docs: `docs/backend/auth-signup.md`, `auth-password-reset.md`, `account-deletion.md`, `features/stripe-payment-gateway.md`, `features/public-share.md` (masing-masing § Update 2026-08-31).

## Architectural Decisions

1. **Satu shell vs duplikasi div:** menghindari drift warna/padding; perubahan brand cukup di `emailShell`.
2. **Hex `#F04E23` (DESIGN.md orange) dipilih atas `#DD7830` (oklch) untuk CTA — vivid, kontras 6.5:1 dengan `#0E0E0E` (lolos AA) vs white-on-orange 3:1.
3. **Table + inline style** bukan `div/flex` — kompat Outlook; `600px` max-width terpusat.
4. **Preheader hidden** untuk preview Gmail/Apple Mail.
5. **Hook `escapeHtml` hoisted** — `emailShell` dipanggil dari fungsi di bawahnya; duplikasi kedua dihapus.
