---
id: "dky-028"
title: "Account Deletion (Async Purge) & Re-registration"
status: completed
priority: critical
effort: high
type: feature
phase: "auth-identity"
tags: ["auth","privacy","stripe","async"]
created_at: 2026-08-19
---

# Account Deletion (Async Purge) & Re-registration

## Objective
Memberikan kemampuan penghapusan akun permanen yang aman dan *right-to-be-forgotten*: soft-delete identitas, hard-delete data operasional, batalkan tagihan Stripe, dan izinkan re-registrasi email yang sama sebagai akun bersih baru tanpa membocorkan jejak data lama.

## Tasks
- [x] **Endpoint** `DELETE /api/me/account` (auth required, modul `Me`) → `202`; idempotent; `deletion_pending` + enqueue job dalam satu transaksi.
- [x] **State machine**: `deletion_status` (`active|deletion_pending|deleted`) pada `users` + `tenants`; tabel `account_deletion_jobs` (`pending|purging|completed|failed`, `attemptCount`, `lastError`, maks 20 percobaan).
- [x] **Schema**: drop FK `users.id` → `auth.users`, indeks unik parsial email aktif (`WHERE deleted_at IS NULL`), anonimisasi `deleted:{userId}` / `Deleted Account`.
- [x] **Async purge** via `Deno.cron` per menit: cancel Stripe subscription (termasuk sweep by `stripeCustomerId`), cancel STB ingestion, hapus embedding vektor, hapus file MinIO/S3, purge DB (dokumen, chunk, percakapan, turn, alternatif, share, tenant_keys, outbox, login_attempts), cleanup Redis, `admin.deleteUser`.
- [x] **Guard**: auth middleware tombstone Redis + filter `deletionStatus='active'`; login & OAuth tolak akun terhapus (`403` + revoke session).
- [x] **Payments race**: webhook tetap mencatat pembayaran tapi skip provisioning untuk tenant non-aktif + rekam jejak billing; purge cancel by customer.
- [x] **Re-registration**: `provisionTenantForUser` untuk login/verify/OAuth; `email_not_confirmed` → pesan 400 jelas; register retry mengirim ulang email verifikasi.
- [x] **Frontend**: tombol hapus akun di `AccountPanelDialog.svelte` (konfirmasi ketik "delete"), redirect ke `/login`.
- [x] **Tests**: 16 langkah `me.account-deletion.test.ts` (termasuk race billing), 5 auth.middleware, 3 user_provision, route 401; `deno check` + `svelte-check` bersih.

## Acceptance Criteria
- Penghapusan berjalan async dan kembali `202`; data operasional terhapus permanen, histori billing & audit tetap.
- Email yang sama bisa di-register ulang sebagai akun baru tanpa memakai tenant lama.
- Subscription Stripe yang dibuat *setelah* permintaan hapus tetap dibatalkan (race tertutup).
- Akun `deletion_pending`/`deleted` tidak bisa login, OAuth, atau memanggil API.
- Pengguna yang belum verifikasi email mendapat pesan error yang jelas + jalur kirim ulang verifikasi.