# STB Ingestion, Chunking, & Embedding Worker

## 1. Core Logic
Fitur ini (`apps/stb-worker`) adalah layanan asinkron berbasis Python (FastAPI) dengan pola **Clean Architecture** yang berjalan secara fisik di dalam STB (Set Top Box). 
Ketika Supabase Trigger mengirimkan sinyal melalui Webhook `/api/ingest`, worker ini akan:
1. **Download**: Mengunduh file PDF dari instans MinIO lokal ke penyimpanan *temporary*.
2. **Extraction & Slicing (Chunking)**: Mengekstrak teksnya halaman per halaman menggunakan `PyMuPDF`, lalu memecah teks tersebut menjadi *chunks* (potongan teks) menggunakan *tokenizer* `tiktoken` (OpenAI cl100k_base).
3. **Rate Limiting (Gatekeeper)**: Memeriksa kuota token harian/menit ke Upstash Redis menggunakan *script Lua* sebelum menembak API eksternal.
4. **Embedding & LLM Description (Parallel)**: Menerjemahkan potongan teks menjadi vektor 768-dimensi secara sekuensial menggunakan API Google Gemini (`gemini-embedding-2`). Bersamaan dengan ini, di *thread* lain, potongan awal teks sepanjang 3000 karakter diproses oleh LLM (`gemini-3.1-flash-lite`) untuk menghasilkan deskripsi/rangkuman paragraf dokumen.
5. **Upserting & Updating**: Mem-format *payload* vektor beserta metadatanya lalu mengunggahnya secara *batch* ke Upstash Vector DB dan Supabase Postgres (`document_chunks`). Terakhir, mengirimkan 1 kali PATCH ke Postgres untuk menandai status menjadi `processed` sekaligus menanamkan `description` dari LLM.

## 2. Flow Diagram
```mermaid
sequenceDiagram
    participant Supabase as PostgreSQL (pg_net)
    participant API as FastAPI (STB Worker)
    participant Disk as Local SSD (MinIO/Temp)
    participant Redis as Upstash Redis (Gatekeeper)
    participant Gemini as Google GenAI
    participant PostgREST as Supabase API
    participant VectorDB as Upstash Vector

    Supabase-)API: POST /api/ingest (document_id)
    API-->>Supabase: 202 Accepted (Queued)
    
    activate API
    API->>PostgREST: GET /rest/v1/documents (Idempotency Check)
    API->>Disk: Download PDF dari MinIO ke /mnt/hdd/worker_tmp
    API->>Disk: Buka PDF dengan PyMuPDF & Terapkan Sliding Window Chunking
    
    par LLM Summary Thread
        API->>Gemini: POST generateContent (gemini-3.1-flash-lite, 3000 chars awal)
        Gemini-->>API: Deskripsi Paragraf Pendek
    and Embedding Thread
        loop Per Chunk
            API->>Redis: POST /eval (Lua Gatekeeper Script: Cek & Potong Token)
            alt Token Habis (Rate Limited)
                Redis-->>API: 0, "TPM_EXHAUSTED", reset_in_ms
                API->>API: Sleep (Tunggu sampai reset)
            else Token Tersedia
                Redis-->>API: 1, "OK", 0
                API->>Gemini: Minta Vektor (dengan Exponential Backoff 429, 50x)
                Gemini-->>API: 768-dimensi Float Array
                API->>API: Buffer Payload ke Memory
            end
            
            opt Jika Buffer >= 50 atau Chunk Terakhir
                API->>PostgREST: POST /rest/v1/document_chunks (Teks Mentah)
                API->>VectorDB: POST /upsert (Vektor + Metadata)
                API->>API: Kosongkan Buffer
            end
        end
    end
    
    API->>PostgREST: PATCH /rest/v1/documents (status='processed', description='...')
    API->>Disk: Hapus file temp (Cleanup)
    deactivate API
```

## 3. Deep-Dive: Slicing / Chunking Mechanism
Saat ini sistem menggunakan teknik **Sliding Window Chunking**:
- **Ukuran Potongan (`chunk_size`)**: 1000 token.
- **Tumpang Tindih (`overlap`)**: 150 token.
- **Alasan**: Ketika sebuah dokumen dipecah secara buta per 1000 token, ada kemungkinan kalimat penting atau gagasan utama terbelah dua tepat di batas pemotongan. Dengan memaksa *chunk* selanjutnya untuk "mundur" dan mengambil 150 token dari *chunk* sebelumnya (*overlap*), kita memastikan bahwa konteks di sekitar perbatasan tidak hilang (konteks terhubung/tidak terputus).

## 4. Deep-Dive: Gatekeeper & Limiting
Layanan AI eksternal seperti Google Gemini memiliki batasan RPM (Requests Per Minute) dan TPM (Tokens Per Minute). Jika STB Worker membombardir Gemini secara membabi-buta:
1. Akun Google API akan diblokir atau di-*throttle* (HTTP 429).
2. Sistem akan *crash* karena tidak ada *backoff*.

**Solusi Arsitekturnya:**
- **Lua Script Gatekeeper**: STB mengeksekusi *script* atomik ke **Upstash Redis** melalui REST API. Script ini mengelola kuota *global* (lintas STB/Tenant).
- **Token Deduction**: Sebelum meminta vektor, STB menaksir estimasi token (panjang string / 3). Jika sisa token di Redis tidak cukup, Redis menolak request dan mengembalikan waktu `PTTL` (kapan kuota reset).
- **Sleep & Auto-Resume**: Worker di STB akan otomatis `time.sleep()` selama `PTTL` tersebut (tanpa mematikan *container*), lalu melanjutkan *embedding* begitu kuota terisi kembali. Ini membuat *ingestion* puluhan ribu halaman berjalan sangat stabil walau memakan waktu semalaman (Fire-and-Forget).
- **Server Error Resilience**: Selain 429, mekanisme *retry* eksponensial juga melindungi eksekusi dari *down*-nya server Google (meng-_handle_ kode 500, 502, 503, dan 504) sehingga *worker* bisa menunggu sistem eksternal normal tanpa meledak *crash* membuang sisa dokumen.

## 5. Architectural Decisions
- **REST API for Databases & AI:** STB Worker murni menggunakan HTTP (REST via `httpx`) untuk PostgREST, Upstash Vector, Upstash Redis, dan Gemini. Hal ini membuang *overhead* dependensi SDK/Driver ORM berat (seperti `psycopg2` atau `redis-py`) demi menyesuaikan kapabilitas CPU S905X di STB.
- **Push-over-Pull & Idempotency:** STB dibangun murni digerakkan oleh webhook (Supabase Trigger `pg_net`), BUKAN dengan cara *long-polling* database setiap 5 detik. Jika webhook gagal atau *timeout*, `pg_net` akan me-*retry*. Untuk mencegah *double processing*, STB melakukan pengecekan idempoten di awal (`status == 'processed'`).
- **Memory Constraint Mitigation:** Alih-alih melahap seluruh PDF ke dalam RAM (yang sangat langka di STB), PDF didownload murni ke SSD/External HDD (`/mnt/hdd/worker_tmp`), diproses secara berurutan, lalu *garbage file*-nya selalu dihapus di dalam block `finally`.
- **Parallel LLM Summarization:** Untuk menghemat waktu eksekusi, pengambilan vektor per *chunk* dan pembuatan deskripsi 2-3 kalimat dokumen (menggunakan 3000 karakter pertama via `gemini-3.1-flash-lite`) diparalelisasi (*multithreaded* via `ThreadPoolExecutor`). Fitur LLM disetel agar melakukan *Graceful Degradation* (kembali kosong jika terblokir *safety filters* Google) agar tidak membatalkan operasi inti vektorisasi. Keduanya kemudian dirapatkan dalam **satu kali** HTTP PATCH akhir ke database untuk meminimalkan beban I/O.

## 6. Completion Timestamp
**Completed At:** 2026-06-27T23:30:00+07:00 (WIB)
