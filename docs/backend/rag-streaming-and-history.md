# RAG Streaming & Conversation History

## 1. Core Logic
Fitur ini meng-handle Q&A dari pengguna dengan melakukan *Hybrid Search* (Semantic + Full-Text) ke Upstash Vector, merakit (Context Engineering) hasilnya, dan memberikan jawaban *streaming* menggunakan Google Gemini (SSE Stream). Selain itu, fitur ini juga menyimpan riwayat *chat* ke PostgreSQL dan memungkinkan pengguna mengambil daftar percakapan (*history list*) yang terurut berdasarkan waktu paling mutakhir (berdasarkan *timestamp* turn terakhir).

> **UPDATE (2026-08-07):** Sejak *Lifecycle V2*, turn dibuat **write-ahead** di awal request dengan `status='processing'` dan selalu dituntaskan (`complete | stopped | failed | blocked`). Cancel kini **menyimpan jawaban parsial** sebagai `stopped` (bukan dilewati), dan `conversation_turns` sudah punya kolom `status` + `updated_at` serta `model_used` nullable. Dokumentasi lengkap: [`rag-turn-status-and-edit-mode.md`](./rag-turn-status-and-edit-mode.md).
>
> **UPDATE (2026-08-09):** Fitur **retry variants** — `POST /api/rag/chat` menerima `retry_turn_id` (stream jawaban alternatif ke `turn_alternatives`, hanya turn terakhir) dan `selected_variant_id` (follow-up memakai jawaban varian sebagai konteks history; dipromosikan ke turn kanonik saat sukses, varian lain dihapus). Event SSE baru `turn_started` (id write-target di awal stream — turn `stopped` tetap bisa di-retry tanpa reload). `GET /api/rag/conversations/:id` kini mengembalikan `turns[].alternatives`. Detail: [`rag-turn-status-and-edit-mode.md` §15](./rag-turn-status-and-edit-mode.md).
>
> **UPDATE (2026-08-10):** **Stop ≠ disconnect.** Tombol stop kini eksplisit via `POST /api/rag/turns/{id}/stop` (turn difinalisasi `stopped` dengan jawaban parsial). Disconnect (keluar halaman / pindah percakapan) **tidak** menghentikan generasi: turn di-flip `awaiting_indexing` sebagai jaring pengaman, generasi dilanjutkan in-process (fast path — jawaban penuh tersimpan saat selesai), dan sweep (Deno.cron) hanya fallback kalau isolate mati. Generasi berjalan di `AbortController` terpisah (`stopGenerationAbort`) yang hanya menyala saat stop eksplisit. Detail: [`rag-turn-status-and-edit-mode.md` §16](./rag-turn-status-and-edit-mode.md).

## 2. Flow Diagram
```mermaid
sequenceDiagram
    participant User
    participant Hono (RagService)
    participant Upstash (Vector)
    participant Gemini (LLM)
    participant PostgreSQL

    User->>Hono: POST /api/rag/chat (question, conversationId?)
    Hono->>Upstash: Execute Hybrid Search (query)
    Upstash-->>Hono: Top K Document Chunks
    Hono->>Gemini: Stream Request (Prompt + Context)
    Gemini-->>Hono: SSE Stream Tokens
    Hono-->>User: SSE Stream Tokens

    alt User Stops (explicit)
        User-->>Hono: POST /api/rag/turns/{id}/stop (ditunggu ack)
        Note over Hono: activeGenerations[turnId].stopRequested = true; stopGenerationAbort.abort()
        Hono-->>Gemini: abort stream LLM (signal khusus stop)
        Note over Hono: UPDATE turn → status='stopped', answer parsial
    else Client Disconnects (keluar halaman / pindah percakapan)
        User-->>Hono: koneksi SSE mati (tanpa stop)
        Note over Hono: cancelSignal fires → flip turn → awaiting_indexing (jaring pengaman)
        Note over Hono: generasi DILANJUTKAN in-process (fast path) — enqueue dihentikan
        Hono-->>Gemini: terus konsumsi token (stopGenerationAbort tidak menyala)
        Note over Hono: UPDATE turn → status='complete' (gate awaiting_indexing) saat selesai
        Note over Hono: fallback: isolate mati → sweep (Deno.cron) regenerate dari awaiting_indexing
    else Stream Completes
        Gemini-->>Hono: [DONE]
        Hono->>PostgreSQL: UPDATE turn → status='complete' (row sudah ada via write-ahead)
        Hono->>PostgreSQL: UPDATE conversations SET updated_at = NOW()
    end
    
    User->>Hono: GET /api/rag/conversations?limit=20&cursor=...
    Hono->>PostgreSQL: SELECT conversations ORDER BY updated_at DESC LIMIT 20
    PostgreSQL-->>Hono: List of conversations
    Hono-->>User: 200 OK + nextCursor

    User->>Hono: GET /api/rag/conversations/:id
    Hono->>PostgreSQL: SELECT conversations AND conversation_turns
    PostgreSQL-->>Hono: Conversation data with turns
    Hono-->>User: 200 OK
```

## 3. Completion Timestamp
**Completed At:** 2026-06-30T18:45:00+07:00 (WIB)  
**Stream Cancellation Added:** 2026-08-05T19:21:00+07:00 (WIB)  
**Stream Cancellation Hardened:** 2026-08-05T20:40:00+07:00 (WIB)  
**Citation & Source Reference Display Hardened:** 2026-08-05T21:20:00+07:00 (WIB)

## 4. File Mapping
- `apps/backend/src/modules/rag/rag.service.ts`: Logika *streaming*, *hybrid search*, penyimpanan `updated_at`, denormalisasi `contextReferences`, `filterReferencesByCitations()`, `AbortSignal.any()` untuk combined cancel signal, helper `isConsumerGone()` (cek live abort + `desiredSize` backpressure), dan guard DB save.
- `apps/backend/src/modules/rag/rag.controller.ts`: Endpoint `handleChat`, `handleListConversations`, `handleGetConversation`, `handleUpdateConversationTitle`, `handleDeleteConversation`. Meneruskan `c.req.raw.signal` ke service layer.
- `apps/backend/src/modules/rag/rag.routes.ts`: Deklarasi OpenAPI Zod untuk semua endpoint di atas.
- `apps/backend/src/modules/rag/rag.schema.ts`: `ContextReferenceSchema`, `ConversationTurnSchema`, `ChatServiceParams` (dengan `signal?: AbortSignal`).
- `apps/backend/src/modules/rag/llm_router.service.ts`: Routing BYOK ke provider (Gemini, Mistral, OpenRouter) dengan dukungan `AbortSignal` — check di loop untuk SDK, pass ke `fetch()` untuk HTTP.
- `apps/backend/src/modules/rag/fallback_llm.service.ts`: Fallback pool 5 provider (Gemini, Mistral, Groq, SambaNova, Cohere) dengan dukungan `AbortSignal`.
- `apps/backend/src/modules/rag/rag.service.test.ts` & `apps/backend/src/modules/rag/rag.routes.test.ts`: Unit/integration test untuk cancel, save guard, dan filter references.
- `apps/backend/src/shared/models/db.model.ts`: Skema tabel `conversations` dan `conversation_turns`.
- `apps/frontend/src/routes/app/chat/[id]/+page.svelte`: Parsing SSE, typewriter, `AbortController`/`signal`, `transformCitationTags()`, render Source References, dan `loadConversation()` dari history.

## 5. Architectural Decisions
- **Push-Over-Pull SSE**: SSE diproses secara *real-time* langsung dari *generator* LLM tanpa antrean polling, menghemat biaya komputasi Edge/Serverless.
- **Write-Time UpdatedAt Touch**: Karena struktur RAG, setiap *turn* baru harus menyentuh `updated_at` pada `conversations` agar *sidebar history* bisa disortir dengan `ORDER BY updated_at DESC` tanpa *join*. Hal ini dilakukan secara eksplisit pada lapisan Service dengan `tx.update(conversations).set({ updatedAt: new Date() })` bersamaan dengan `tx.insert(conversationTurns)`.
- **Cursor-Based Pagination**: Endpoint `GET /api/rag/conversations` menggunakan paginasi berbasis kursor (menggunakan `updated_at`) daripada *offset-based* untuk mencegah redundansi data akibat pembaruan posisi *row* saat obrolan baru berlangsung, dan sangat optimal untuk *Infinite Scroll* di sisi SvelteKit.
- **Denormalization for Context References**: Daripada menggunakan SQL `JOIN` dari array JSONB `chunkIds` ke tabel `document_chunks` (yang lambat dan melanggar prinsip *immutability* sejarah), `contextReferences` disimpan langsung dengan format terstruktur `[{ documentId, pages: [...] }]` saat penulisan (`INSERT`). Dengan ini, query `GET /api/rag/conversations/:id` dapat beroperasi dalam kecepatan sub-10ms (Zero-JOIN).
- **SSE Fallback Streaming**: Jika model LLM pertama gagal karena *Rate Limit*, *circuit breaker* otomatis mencari fallback model lain dan meneruskan token *streaming* ke Svelte.
- **Prompt Injection Gatekeeper**: Mengeksekusi *pre-flight prompt* dengan model *lite* untuk mendeteksi injeksi perintah sebelum masuk ke jalur RAG utama demi keamanan basis data konteks.
- **Combined AbortSignal untuk DETEKSI, AbortController terpisah untuk GENERASI**: `cancelSignal` menggabungkan dua sumber sinyal:
  ```ts
  const streamAbort = new AbortController();
  const cancelSignal = signal
      ? AbortSignal.any([signal, streamAbort.signal])
      : streamAbort.signal;
  ```
  - `signal` = `c.req.raw.signal` (abort dari request HTTP).
  - `streamAbort.signal` = dipicu oleh callback `cancel()` pada `ReadableStream`, yang dipanggil runtime saat consumer (HTTP layer) mendeteksi client disconnect.
  
  Sejak Lifecycle V3, `cancelSignal` **hanya untuk deteksi teardown** (flip jaring pengaman + berhenti enqueue). Panggilan LLM (fallback & BYOK) memakai **`stopGenerationAbort.signal`** — controller terpisah yang hanya di-abort oleh endpoint `/stop` — sehingga disconnect tidak pernah memutus stream LLM yang sedang berjalan (fast path).
- **Stop vs Disconnect (Lifecycle V3)**: Koneksi client dibedakan menjadi dua kasus teardown:
  - **Stop eksplisit** (`POST /api/rag/turns/{id}/stop`): registri in-memory `activeGenerations` (key = write-target id) menandai `stopRequested` dan me-abort **`stopGenerationAbort`** — `AbortController` terpisah yang hanya menyala saat stop. Generasi dihentikan, turn difinalisasi `stopped` dengan jawaban parsial. Frontend menunggu ack endpoint sebelum men-teardown stream lokal.
  - **Disconnect** (tanpa stop): `cancelSignal` tetap menyala, tapi **generasi tidak di-abort** — loop token berhenti meng-enqueue dan melanjutkan akumulasi jawaban in-process (fast path). Turn di-flip `awaiting_indexing` sebagai jaring pengaman; saat generasi selesai, jawaban penuh ditulis `complete` dengan gate `awaiting_indexing`. Kalau isolate mati lebih dulu, `sweepAwaitingTurns` (Deno.cron) meregenerasi dari turn `awaiting_indexing`. Retry variant pada disconnect → `stopped`.
- **Live Cancel Detection (bukan snapshot)**: Bug awal: `let cancelled = cancelSignal.aborted` disimpan sekali dan tidak pernah diupdate, sehingga loop token tidak pernah berhenti saat cancel terjadi di tengah stream. Perbaikan: helper `isConsumerGone()` dipanggil di **setiap iterasi** kedua token loop (BYOK + fallback), melakukan dua pengecekan:
  1. `cancelSignal.aborted` — sinyal abort benar-benar fired.
  2. `controller.desiredSize <= 0` selama ≥10 iterasi berturut-turut — deteksi backpressure saat HTTP layer berhenti menarik data (client disconnect tanpa signal eksplisit).
  
  Sejak fast-path, `isConsumerGone()` memicu **detach** (flip + lanjutkan in-process), bukan berhenti; hanya `stopRequested` yang menghentikan loop. `controller.enqueue()` tetap di-wrap `try/catch` — jika stream sudah ditutup consumer, `enqueue()` melempar dan loop beralih ke mode detached.
- **DB Save Guard (Iterasi 1 — digantikan Lifecycle V2)**: Awalnya pengecekan `cancelled || cancelSignal.aborted` sebelum `INSERT` membuat turn yang dibatalkan tidak tercatat di riwayat. Sejak Lifecycle V2 (lihat [`rag-turn-status-and-edit-mode.md`](./rag-turn-status-and-edit-mode.md)), turn dibuat write-ahead di awal dan **selalu** dituntaskan: stop eksplisit → `stopped` (parsial), selesai → `complete`, gagal server → `failed`, injeksi → `blocked`, disconnect → `awaiting_indexing` lalu `complete` (fast path / sweep).

## 6. Context References & Citation Rendering

### 6.1 Data Shape
Setiap turn menyimpan `contextReferences` sebagai array JSONB dengan struktur:
```json
[
  {
    "index": 1,
    "documentId": "76f80810-94d5-4cb3-8b73-d37c14dcf26d",
    "title": "annual_report_pt_harum_energy_tbk_2020.pdf",
    "pages": [48]
  }
]
```
Field `title` berasal dari metadata dokumen saat chunk di-*ingest*.

### 6.2 Filtering by Inline Citations
`RagService.filterReferencesByCitations(answer, references)` dipakai di dua tempat:
1. **Saat stream selesai** — sebelum menyimpan turn, untuk hanya menyimpan referensi yang benar-benar dikutip di jawaban.
2. **Saat `GET /api/rag/conversations/:id`** — server memfilter ulang referensi berdasarkan `answer` yang tersimpan, sehingga client tidak perlu memfilter sendiri.

Regex inline citation yang dikenali:
```regex
/\[Doc (\d+)(?::\s*(?:Hlm\.|Pages?|Page)?\s*([^\]]+))?\]/gi
```
Contoh: `[Doc 1: 48]`, `[Doc 1: Hlm. 48]`, `[Doc 1: Pages 48, 50]`.

### 6.3 Frontend Rendering
- **Inline citation chips** di-render oleh `transformCitationTags()`. Chips menampilkan nama dokumen (tanpa ekstensi, max 20 karakter + ellipsis) dengan tooltip nama lengkap.
- **Source References block** muncul hanya ketika stream benar-benar selesai (`isStreaming === false`) dan tidak dibatalkan (`isCancelled === false`).
- **Saat streaming**, event SSE `event: references` langsung di-assign ke `messages[asstIndex].references` agar inline chips segera menampilkan nama file, bukan fallback `Doc N`.
- **Saat load history**, `loadConversation()` memetakan `contextReferences` dari API ke `DocReference` dengan field `index`, `id`, `name`, dan `pages`, lalu me-render ulang markdown dengan references tersebut.

### 6.4 Abort on Cancel
Tidak ada endpoint cancel terpisah. Frontend membatalkan dengan `AbortController.abort()` pada request `POST /api/rag/chat`. Backend menerima sinyal tersebut via `c.req.raw.signal`, langsung menghentikan konsumsi LLM, dan — sejak Lifecycle V2 — **menyimpan jawaban parsial** dengan `status='stopped'` (sebelumnya dilewati begitu saja).

## 7. Retry Variants & History Override (2026-08-09)

### 7.1 Event `turn_started`

Event pertama di setiap stream (main, prompt-injection block, provider-unavailable):

```
event: turn_started
data: {"turnId":"...","variantId":"..."}   // variantId hanya untuk retry
```

Id write-target dilaporkan sebelum token pertama. Sebelumnya frontend hanya tahu id turn dari `event: done` — stream yang di-cancel (turn `stopped`) tidak punya id, sehingga retry/edit butuh reload. Dengan `turn_started`, id sudah ada sejak awal.

### 7.2 Retry (`retry_turn_id`)

- Hanya turn terakhir (`ORDER BY createdAt DESC, id DESC`), bukan `processing`; wajib `conversation_id`.
- Pipeline penuh dijalankan ulang dengan `turn.question` (dari DB, bukan body); stream ditulis ke baris `turn_alternatives` (bukan `conversation_turns`) — state machine write-ahead/finalize sama.
- `event: done` membawa `variantId`.

### 7.3 Follow-up dengan `selected_variant_id`

Saat follow-up normal menyertakan `selected_variant_id`:

1. Jawaban varian tersebut **menggantikan** jawaban kanonik turn terakhir di `historyText` (query-rewrite memakainya) — validasi varian milik turn terakhir, turn in-flight (hasil write-ahead) di-exclude.
2. Jika turn baru finalize `complete`: varian terpilih **dipromosikan** ke baris turn kanonik (answer/model/latency/references, `status='complete'`, feedback direset), lalu **semua** varian turn itu dihapus. Tanpa seleksi → semua varian dihapus. Follow-up `stopped`/`failed` tidak menghapus apa pun.

### 7.4 `getConversation` — `alternatives`

Setiap turn mengembalikan `alternatives` (hanya varian terminal non-kosong, `contextReferences` difilter ulang per varian). Frontend memakainya untuk browser `◀ N/M ▶` dan tetap konsisten setelah reload.
