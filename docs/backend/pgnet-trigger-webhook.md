# Supabase pg_net Webhook Trigger

## 1. Core Logic
Fitur ini bertugas mengotomatisasi pengiriman sinyal dari Database (Supabase PostgreSQL) ke MinIO STB Worker secara asinkron menggunakan ekstensi `pg_net`. Ketika `status` dokumen berubah menjadi `confirmed`, *trigger* PostgreSQL secara otomatis menembak *webhook HTTP POST* ke Cloudflare Tunnel milik STB Worker.

## 2. Flow Diagram
```mermaid
sequenceDiagram
    participant API as Deno API Gateway
    participant DB as PostgreSQL (Supabase)
    participant STB as STB Worker (Cloudflare Tunnel)

    API->>DB: UPDATE documents SET status='confirmed'
    activate DB
    DB->>DB: AFTER UPDATE Trigger Fires
    DB->>DB: pg_net constructs HTTP POST request
    DB-)STB: Async POST /api/ingest (document_id, tenant_id)
    deactivate DB
    STB-->>STB: Background processing (Chunking & Embedding)
```

## 3. Completion Timestamp
**Completed At:** 2026-06-27T12:35:00+07:00 (WIB)

## 4. File Mapping
- **Created:**
  - `apps/backend/drizzle/migrations/0002_pgnet_trigger.sql` (File migrasi SQL Drizzle kustom)

## 5. Connections
- **Database:** Mengaktifkan ekstensi `pg_net` (native Supabase) dan membuat fungsi `notify_document_uploaded` berbasis PL/pgSQL, lalu mengaitkannya ke tabel `documents` via `AFTER UPDATE` *trigger*.
- **Worker (STB):** Menerima webhook secara *stateless* dan *async* dengan *payload JSON* berisi identifier yang dibutuhkan.

## 6. Architectural Decisions
- **Event-Driven Database Triggers:** Menggunakan `pg_net` alih-alih melempar HTTP request dari Deno. Keputusan ini menjamin webhook *terjamin (guaranteed)* dikirim hanya jika transaksi database benar-benar di-*commit*, meminimalisasi inkonsistensi data.
- **Async Execution:** Ekstensi `pg_net` berjalan sepenuhnya *asynchronous* tanpa memblokir koneksi database Deno. Transaksi Deno akan langsung ditutup meskipun webhook lambat merespons.
- **Target URL Hardcoding:** URL webhook sementara diisi `https://worker.dokyudo.my.id/api/ingest` (akan disesuaikan dengan infrastruktur *routing* CF Tunnel STB).
- **Trigger `AFTER UPDATE` vs `AFTER INSERT`:** Berbeda dari spesifikasi awal, *trigger* ini sengaja dipasang sebagai `AFTER UPDATE` spesifik saat `status = 'confirmed'`. Hal ini mencegah webhook ditembak sebelum file fisik sepenuhnya terunggah ke MinIO.

## 7. Document Status Lifecycle
Kolom `documents.status` sekarang menggunakan **typed PostgreSQL enum** (`document_status_enum`):

| Status | Makna | Dipicu oleh |
|---|---|---|
| `pending` | Presigned URL digenerate, file belum diunggah | Backend Deno (`createPresignedUrl`) |
| `confirmed` | File berhasil diunggah ke MinIO, trigger menembak webhook | Backend Deno (`confirmUpload`) |
| `processed` | Semua *chunk* berhasil di-*embed* dan diindeks | STB Worker (akhir job) |
| `quota_exhausted` | Kuota harian Cloudflare (TPD) habis di tengah proses | STB Worker (Gatekeeper) |
| `failed` | Error tak terduga — PDF corrupt, jaringan, atau storage gagal | STB Worker / Deno (`confirmUpload`) |

## 8. Completion Timestamp
**Completed At:** 2026-07-14T19:12:00+07:00 (WIB)
