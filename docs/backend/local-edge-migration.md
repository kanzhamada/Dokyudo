# Dokyudo Local-Edge Migration Plan

Dokumen ini merangkum strategi, arsitektur, dan langkah-langkah transisi proyek Dokyudo dari arsitektur *Cloud-Dependent* (Deno Deploy, Supabase, Upstash) menuju arsitektur **Local-Edge Baremetal** (Deno Systemd, PGlite, Deno KV) yang berjalan 100% mandiri di atas perangkat STB (Amlogic S905X).

## 1. Perbandingan Arsitektur

| Komponen | Arsitektur Lama (Cloud) | Arsitektur Baru (STB Local-Edge) | Alasan Perubahan |
| :--- | :--- | :--- | :--- |
| **Backend Host** | Deno Deploy (Serverless) | Baremetal Deno via Systemd | Menghilangkan latensi jaringan ke database/storage lokal, mengoptimalkan I/O SSD. |
| **Database Relasional** | Supabase (PostgreSQL) | PGlite (WASM Postgres in Deno) | PGlite berjalan *in-process* memakan RAM minimal (<50MB) dan sangat cepat karena 100% lokal. |
| **Vector Database** | Upstash Vector | PGlite (`pgvector` extension) | Menyatukan data teks dan vektor dalam satu DB; Hybrid Search dapat dilakukan dalam 1 kueri SQL. |
| **Cache & Rate Limit** | Upstash Redis | Deno KV | Menghilangkan network HTTP overhead (~30ms) menjadi 0ms, memanfaatkan disk STB untuk persistensi. |
| **Authentication** | Supabase Auth (GoTrue) | Lucia Auth + Arctic | Lepas dari dependensi cloud Supabase sepenuhnya, menyimpan session/user lokal. |
| **Database Triggers** | `pg_net` (Postgres Trigger) | `fetch()` langsung di kode Deno | Menghindari pengaturan ekstensi DB yang rumit; pemanggilan instan *localhost* ke STB Worker. |
| **Cron Jobs** | `pg_cron` (Supabase Cron) | `Deno.cron()` | Logika penjadwalan menyatu dalam *source code* Deno, mudah di-track via Git. |
| **CI / CD Deployments**| GitHub Actions (Vercel/Deno) | Webhook Receiver + CF Tunnel | Sangat ringan, deploy dalam hitungan detik via `git pull` & `systemctl restart`. |

---

## 2. Strategi Git (Isolation & Parallel Run)

Jangan menghapus atau merusak kode *Cloud* yang sedang berjalan.
1. Buat branch migrasi: `git checkout -b arch/local-edge`.
2. Seluruh modifikasi di bawah ini hanya di-*commit* ke branch `arch/local-edge`.
3. Selama masa testing, *Cloud* tetap berjalan di branch `main`. STB Lokal menggunakan branch migrasi.

---

## 3. Fase Migrasi Kode

### Fase 3.1: Mengganti Sistem Autentikasi (Lucia Auth)
*Kehilangan Supabase Auth berarti kita harus membuat tabel dan pengaturan session secara mandiri.*

1. **Skema Database (Drizzle):** Buat tabel `users` dan `sessions`.
2. **Setup Lucia:** Inisialisasi Lucia di Deno menggunakan adapter Drizzle.
3. **Setup Arctic (OAuth):** Konfigurasikan OAuth Google/GitHub untuk menerima *callback*, membuat *user* di tabel lokal, dan menerbitkan *Session ID* via *Cookie*.
4. **Middleware:** Hapus verifikasi JWT Supabase di Hono, ganti dengan middleware Lucia yang membaca *Cookie* dan memvalidasinya ke PGlite/Deno KV.

### Fase 3.2: Migrasi Database ke PGlite
1. **Instalasi:** Tambahkan package `@electric-sql/pglite` dan PGlite Drizzle driver.
2. **Koneksi Drizzle (`drizzle.ts`):** 
   Ganti koneksi standar `postgres` dengan `PGlite`.
   ```typescript
   import { PGlite } from '@electric-sql/pglite';
   import { drizzle } from 'drizzle-orm/pglite';
   const client = new PGlite('/mnt/hdd/database/dokyudo_db'); // Simpan di SSD
   export const db = drizzle(client);
   ```
3. **Ekstensi `pgvector`:** PGlite mendukung `pgvector`. Kita akan memodifikasi skema `document_chunks` untuk memiliki kolom `vector(768)` dan menghapus pemanggilan ke API Upstash Vector.

### Fase 3.3: Migrasi Deno KV (Pengganti Redis)
1. Hapus semua pemanggilan HTTP ke API REST Upstash Redis (terutama pada logika *Rate Limiting* / *Gatekeeper*).
2. Ganti dengan fungsi Deno KV: `const kv = await Deno.openKv('/mnt/hdd/database/kv_data');`
3. Gunakan `kv.atomic()` untuk *Rate Limiting* agar transaksi aman dari *race condition*.

### Fase 3.4: Penghapusan `pg_net` & `pg_cron`
1. **Webhook Ingestion:** Pada *service* pengunggahan dokumen, setelah `db.update` status ke `confirmed`, langsung panggil `fetch('http://127.0.0.1:8080/api/ingest', ...)` secara *asynchronous* dari dalam Deno untuk mentrigger *STB Worker (Python)*.
2. **Cron Job:** Buat file `cron.ts` yang berisi `Deno.cron(...)` untuk melakukan *Reset Tenant Quota* setiap awal bulan langsung menggunakan *query* Drizzle.

---

## 4. CI / CD (Webhook Receiver & Cloudflare Tunnel)

Karena Deno Deploy tidak lagi digunakan, kita membuat mekanisme *Push-to-Deploy* sederhana dan ringan.

**Alur Kerja:**
1. Developer melakukan `git push` ke GitHub (`arch/local-edge`).
2. GitHub Webhook menembak URL Publik STB: `POST https://api.dokyudo.my.id/api/webhooks/deploy`. (Di-*routing* secara aman oleh Cloudflare Tunnel masuk ke STB).
3. Backend Deno menerima request, memvalidasi HMAC Secret dari GitHub.
4. Jika valid, Deno mengeksekusi skrip lokal (bash):
   ```typescript
   new Deno.Command("bash", { args: ["scripts/deploy.sh"] }).spawn();
   ```

**Isi dari `scripts/deploy.sh`:**
```bash
#!/bin/bash
echo "Menarik kode terbaru..."
git fetch origin arch/local-edge
git reset --hard origin/arch/local-edge

echo "Mengunduh dependensi (Cache)..."
deno cache src/main.ts

echo "Restarting Deno Backend via Systemd..."
sudo systemctl restart dokyudo-backend
```
*(Catatan: User `deno` atau *process* yang menjalankan script harus memiliki izin `sudo NOPASSWD` untuk `systemctl restart dokyudo-backend` pada Linux sudoers).*

---

## 5. Rencana Cutover & Rollback

1. **Uji Coba Paralel:** Jalankan backend baremetal di STB dengan port yang berbeda (misal `8000`). Lakukan pengujian pengunggahan, chunking, dan pencarian.
2. **Cutover (Migrasi Final):** Arahkan DNS Cloudflare (Domain API Utama) yang sebelumnya menuju Vercel/Deno Deploy menjadi mengarah ke *Cloudflare Tunnel* STB lokal.
3. **Rollback (Darurat):** Jika STB mati atau memori penuh, cukup kembalikan DNS Cloudflare ke Deno Deploy. Sistem akan kembali menggunakan Supabase & Upstash dalam hitungan detik.
