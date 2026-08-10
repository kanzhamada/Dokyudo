# Document Mention — "Second Brain" `@` (Main Context)

## Core Logic

Fitur ini memungkinkan user **menyebut dokumen yang sudah dimiliki** sebagai **main context** percakapan chat — cukup ketik `@` di kolom input, pilih dokumen dari snippet list, dan retrieval RAG untuk turn tersebut di-scope **hanya** ke dokumen yang dipilih. Ini **bukan** indexing baru dan **bukan** upload: dokumen sudah ter-index (`status='processed'`) dan langsung dijawab interaktif via SSE tanpa menunggu apa pun.

Mekanisme kunci:

- **Token inline** — dokumen yang dipilih disisipkan langsung ke teks pertanyaan sebagai token `@[title](id_doc)` (markdown-link style), diikuti otomatis 1 spasi. Token tersimpan **verbatim** di `conversation_turns.question` — tidak ada kolom/chip terpisah.
- **Rendering dua lapis** — di kolom input, token tampil sebagai badge pill (teknik textarea transparan + overlay); di bubble pesan user, token tampil sebagai tag klik yang membuka PDF viewer (`openCitationPreview`).
- **Scoping retrieval** — id token di-parse client-side saat kirim, digabung dengan id file attachment, dikirim sebagai `attachment_document_ids`. Backend menjawab **interaktif** bila semua dokumen sudah `processed`; dokumen yang masih diingest tetap lewat jalur `awaiting_indexing` (flow upload).
- **Cache dokumen** — daftar `{id, title, status}` tenant di-cache di `documentsStore` (TTL 5 menit, invalidate setelah upload) sehingga popover terbuka instan tanpa spinner.

## Flow Diagram

```mermaid
sequenceDiagram
    actor User
    participant ChatInput as ChatInput.svelte
    participant Store as documentsStore
    participant API as POST /api/rag/chat
    participant RagService
    participant Search as Hybrid Search (scoped)
    participant DB as PostgreSQL

    User->>ChatInput: ketik "@query"
    ChatInput->>ChatInput: deteksi caret regex `(?:^|\s)@([^\s@]*)$`
    ChatInput->>Store: ensureLoaded() (idempotent, TTL 5m)
    Store-->>ChatInput: dokumen status='processed'
    User->>ChatInput: pilih (mouse / Enter, highlight di-clamp, max 5)
    ChatInput->>ChatInput: sisipkan `@[title](id)` + spasi
    User->>ChatInput: Enter (kirim)
    ChatInput->>API: question (berisi token) + attachment_document_ids (files only)
    API->>RagService: parse token dari question + validasi kepemilikan/status
    alt Semua dokumen processed
        RagService->>RagService: strip token dari prompt (rewrite/history/augmented/title)
        RagService->>Search: search documentIds=[files + mention] (main context)
        RagService-->>User: SSE interaktif (token stream)
    else Ada dokumen belum processed
        RagService-->>User: event awaiting_indexing → polling (flow upload)
        RagService->>DB: sweep menyelesaikan turn setelah semua processed
    end
    RagService->>DB: simpan turn (question = teks asli + token)
    User->>User: bubble pesan → tag @judul → PDF viewer
```

## 1. Token Format & Parsing

Format token: `@[judul](uuid)` — persis seperti markdown link dengan prefix `@`. Di editor input, badge men-serialisasi bentuk tanpa id (`@[judul]`) agar lebar badge cocok dengan posisi caret; saat kirim, `formatMentionsForPayload` meng-kanonikalisasi ke `@[judul](uuid)` untuk storage backend.

**Aturan limit (first-5):** hanya **5 token pertama** yang diperlakukan sebagai mention — token ke-6+ adalah **teks biasa**: tidak dirender badge, tidak di-scope ke dokumen, tidak di-strip dari prompt, dan **dihitung** sebagai karakter menuju limit 690. Aturan ini diterapkan seragam di frontend (`parseMentionIds`, `splitMentionSegments`, `stripMentionTokens`, `formatMentionsForPayload` — semua memakai `MAX_DOCUMENT_MENTIONS = 5`) dan backend (`mention-tokens.util.ts`).

- **`mentionToken(title, id)`** membangun token dengan **sanitasi judul**: `]` di-strip karena satu-satunya karakter yang merusak format (regex parser tidak akan mengenali `@[a]b](id)` → render jadi teks mentah). `)`, `(`, `[` aman.
- **`parseMentionIds(text)`** mengekstrak id unik dari 5 token pertama (id dari token atau lookup judul di store) untuk pengecualian kandidat & limit.
- **`splitMentionSegments(text)`** memecah teks menjadi segmen `text` / `mention` untuk rendering badge (editor input + bubble pesan); token ke-6+ jatuh ke segmen teks biasa. Karena parsing dilakukan client-side dari teks tersimpan, pesan yang dimuat ulang dari history tetap ter-render dengan benar.
- **`stripMentionTokens(text)` / `mentionStrippedLength(text)`** — menghapus 5 token pertama (untuk penghitungan karakter; backend memakai versi yang sama untuk prompt).

## 2. Frontend — Input UX (ChatInput.svelte)

**Trigger popover:** `updateMentionState()` dijalankan pada `oninput`/`onfocus` — regex `(?:^|\s)@([^\s@]*)$` terhadap teks **sebelum caret**. Guard: caret tepat setelah token yang sudah ada (query dimulai `[`) tidak membuka popover lagi.

**Kandidat:** hanya dokumen `status='processed'` (satu-satunya yang siap jadi main context), belum di-mention (id token yang sudah ada di teks dikecualikan), filter case-insensitive per ketikan, urut alfabetis, maks 30.

**Keyboard navigation:**
- `↑`/`↓` memutar highlight; `Enter` memilih; `Esc` menutup; `Enter` saat popover terbuka **tidak** mengirim pesan.
- **`effectiveHighlight`** — derived yang meng-clamp indeks ke panjang daftar. Tanpa clamp, indeks bisa basi saat ketikan mempersempit daftar (mis. `↓` lalu ketik huruf filter) → Enter dapat `undefined` → popover menutup diam-diam tanpa menyisipkan (bug yang pernah terjadi).
- `scrollIntoView({block:'nearest'})` pada item highlight → posisi UI mengikuti navigasi keyboard.
- **Guard loading:** Enter saat daftar masih kosong karena store sedang fetch tidak menutup popover — tetap terbuka sampai kandidat tiba.

**Penyisipan:** token menggantikan `@query` di posisi caret, lalu **auto-spasi 1** — kata berikutnya tidak menempel ke token dan deteksi `@` berikutnya tetap akurat. Penghapusan = backspace biasa (teks polos).

## 3. Badge Overlay di Input (Teknik Textarea Transparan)

`<textarea>` tidak bisa merender styled span, jadi badge ditampilkan lewat **overlay**:

- Textarea asli tetap editor (caret, selection, paste, edit native) dengan teks transparan — dipaksa via **inline style** `color: transparent` (tidak bisa dikalahkan class-merge/CSS apa pun), `caret-white`, `selection:bg-white/15`.
- Overlay `pointer-events-none absolute inset-0` di belakang textarea merender isi yang sama via `splitMentionSegments` — token menjadi pill, teks biasa menjadi teks.
- **Keselarasan wajib** (badge harus duduk persis di posisi token): padding sama (`px-2.5 py-1.5` — mengikuti base class komponen Textarea), font sama (`text-base md:text-sm`), wrapping sama (`break-words whitespace-pre-wrap`), scrollTop di-mirror ke overlay (via `$effect` + `onscroll`).
- Placeholder tetap milik textarea; warna teks mode `transparent` (landing page) dipertahankan lewat `group-focus-within` di overlay.
- Style pill monokrom selaras tema Dokyudo: `border-white/15 bg-white/10 text-white/80`, icon `text-white/60` — sama seperti chip citation.

## 4. Storage, Karakter & Payload

- **Penyimpanan:** `question` dikirim apa adanya (termasuk token) → tersimpan verbatim di `conversation_turns.question`. Tidak ada perubahan backend untuk storage.
- **Limit karakter (mention tidak dihitung):** counter `/690` di ketiga tempat (landing, detail, edit bubble) dan validasi backend sama-sama menghitung teks **tanpa 5 token pertama** (`mentionStrippedLength` frontend ↔ `stripMentionTokens` di zod `superRefine`). Pertanyaan yang hanya berisi token ditolak ("Question cannot be empty"). Frontend tidak memakai `maxlength` native pada editor (contenteditable) — batas di-enforce backend; tombol send/guard disabled saat stripped kosong.
- **Payload:** `attachment_document_ids` kini **murni file upload** (max 10) — id mention TIDAK lagi dikirim di situ. Backend mem-parse token dari question sendiri (`mentionTokenIds`), menggabungkan dengan id file (dedup), memvalidasi kepemilikan (404) dan status terminal (400).
- **Retry/edit:** id mention di-parse ulang dari teks question — retry memakai question asli, edit memakai teks hasil edit → scoping otomatis mengikuti teks.
- **Landing → Detail:** token berada di dalam `initialQuestion` (navigation state) — detail page tidak mem-parse untuk payload; hanya file upload yang lewat `attachmentDocuments` state.

## 5. Message Bubble (Tag Klik → PDF Viewer)

`splitMentionSegments(msg.content)` di bubble pesan user: segmen mention dirender sebagai `<button>` pill monokrom (`border-white/15 bg-white/10`, hover `hover:bg-white/20`) yang memanggil `openCitationPreview(id, title, [])` — membuka panel PDF viewer yang sama dengan citation assistant. Pesan lama yang dimuat dari DB tetap ter-render karena parsing berbasis teks.

## 6. Backend — Semantik "Main Context" & Strip dari Prompt

`rag.service.ts` `streamChat` — pre-flight menggabungkan id mention (di-parse dari question via `mentionTokenIds`) dengan id file `attachment_document_ids` (dedup), lalu memvalidasi (kepemilikan tenant → 404, status terminal `failed`/`failed_vectorizing`/`quota_exhausted` → 400):

```ts
const mentionIds = mentionTokenIds(question);
const scopedDocIds = [...new Set([...(attachmentDocumentIds ?? []), ...mentionIds])];
...
const needsAwaiting =
    hasAttachments && attachmentDocuments.some((doc) => doc.status !== "processed");
```

- **Semua `processed`** → turn `status='processing'` → jalur interaktif: gatekeeper, rewrite, hybrid search **di-scope** (`documentIds` = daftar gabungan tervalidasi), SSE token stream, `finalizeTurn`. Kuota QA terpakai di jalur interaktif.
- **Ada yang belum `processed`** (`pending`/`confirmed`) → turn `awaiting_indexing` + reservasi QA saat submit + stream pendek + diselesaikan `sweepAwaitingTurns` — flow upload file baru, tidak berubah.
- **Scope gabungan di-persist** ke kolom `attachmentDocumentIds` turn — sweep/retry ikut me-rescope mention.
- **Strip dari prompt LLM:** token mention adalah chrome editor, bukan prosa user — `stripMentionTokens` diterapkan di `buildContextAndPrompt` untuk `searchQuery` awal, rewrite prompt, history (question turn sebelumnya juga di-strip), dan augmented prompt (slot `USER QUESTION`); title generation juga memakai question tanpa token. **Guard prompt-injection tetap menerima question mentah** — input user tidak pernah di-strip sebelum security check (title token adalah teks user-controlled; striping sebelum prompt sudah menetralkannya). Question asli (dengan token) yang tersimpan di DB.
- Detail state machine: `docs/backend/rag-turn-status-and-edit-mode.md`.

## 7. Cache Dokumen (documentsStore)

`lib/state/documents.store.svelte.ts` — pola sama dengan `conversationsStore`:
- `ensureLoaded()` idempotent: fetch `GET /api/documents` sekali per sesi, revalidasi bila > 5 menit (TTL).
- `invalidate()` memaksa refetch berikutnya — dipanggil setelah upload file sukses di kedua halaman chat (dokumen baru langsung bisa di-mention setelah `processed`).
- Kedua halaman memanggil `ensureLoaded()` di `onMount`; popover juga memanggilnya saat pertama terbuka (belt-and-braces).

## Completion Timestamp

**Date:** 2026-08-10

## File Mapping

- `apps/frontend/src/lib/utils/doc-mentions.ts`: `MAX_DOCUMENT_MENTIONS` (first-5), `mentionToken` (sanitasi judul), `parseMentionIds`, `splitMentionSegments`, `stripMentionTokens`, `mentionStrippedLength`, `formatMentionsForPayload`.
- `apps/frontend/src/lib/state/documents.store.svelte.ts`: cache dokumen tenant (TTL + invalidate).
- `apps/frontend/src/lib/api/documents.ts`: `getDocuments()` + tipe `DocumentItem`.
- `apps/frontend/src/lib/components/chat/ChatInput.svelte`: editor contenteditable dengan badge node atomic, popover mention (deteksi caret, keyboard nav dengan highlight clamp, scroll-into-view, guard loading, limit 5), penyisipan token + auto-spasi, serialisasi token.
- `apps/frontend/src/routes/app/chat/[id]/+page.svelte`: payload `attachment_document_ids` files-only, rendering tag di bubble pesan → `openCitationPreview`, counter `/690` berbasis stripped, invalidate store setelah upload.
- `apps/frontend/src/routes/app/chat/+page.svelte`: `ensureLoaded` + invalidate; counter berbasis stripped; token mengalir via `initialQuestion`.
- `apps/backend/src/modules/rag/mention-tokens.util.ts`: `mentionTokenIds` + `stripMentionTokens` (first-5, bentuk kanonik ber-id).
- `apps/backend/src/modules/rag/rag.schema.ts`: `superRefine` question — limit 690 & non-empty dihitung dari teks tanpa token.
- `apps/backend/src/modules/rag/rag.service.ts`: parse mention → validasi gabungan → scoping search; strip token dari rewrite/history/augmented prompt/title; persist scope gabungan; guard tetap question mentah.
- `apps/backend/src/modules/rag/rag.service.test.ts`: unit util, schema refine, test integrasi "mentions scoped + stripped + stored verbatim".

## Connections

- **Client (Frontend):** `ChatInput.svelte` + kedua halaman chat — token inline, rendering tag, scoping payload.
- **Deno API (Backend):** `streamChat` memvalidasi attachment dan memutuskan jalur interaktif vs awaiting berdasarkan status dokumen; retrieval di-scope ke `documentIds`.
- **PostgreSQL (Database):** `conversation_turns.question` menyimpan token verbatim; `documents.status` (`pending → confirmed → processed | failed*`) menentukan jalur.

## Related

- `docs/backend/rag-turn-status-and-edit-mode.md` — state machine turn, `awaiting_indexing` vs `processing` (attachment main-context).
- `docs/features/rag-conversation.md` — percakapan RAG, citation, edit/retry/branch.
- `docs/backend/confirm-upload-metadata.md` — siklus status dokumen (`confirmed` ≠ siap retrieval).

## Architectural Decisions

1. **Token inline, bukan chip/struktur terpisah:** token `@[title](id)` hidup di teks question — tersimpan di DB tanpa kolom baru, survive retry/edit, dan rendering hanya urusan client-side. Chip (konsep attach) ditolak karena user eksplisit ingin mention sebagai bagian prompt, bukan lampiran.
2. **Backend mem-parse token sendiri, bukan field terpisah:** `mentionTokenIds(question)` di pre-flight melayani validasi, scoping, dan stripping sekaligus; `attachment_document_ids` kembali murni untuk file upload (max 10).
3. **Limit 5 = aturan parse/render, bukan penolakan:** token ke-6+ diperlakukan sebagai teks biasa di semua lapisan (frontend + backend) — konsisten tanpa perlu error handling khusus.
4. **Mention tidak dihitung sebagai karakter:** limit 690 dan cek non-empty dihitung dari teks tanpa 5 token pertama — frontend (counter, guard send) dan backend (zod `superRefine`) memakai aturan yang sama.
5. **Strip dari prompt, simpan asli di DB:** token dihapus dari rewrite/history/augmented prompt/title agar konteks LLM hemat; `conversation_turns.question` tetap menyimpan token verbatim agar frontend bisa render dari history. Guard prompt-injection tetap memakai question mentah (input user tidak pernah di-strip sebelum security check).
6. **`processed` = satu-satunya status siap mention:** `confirmed` hanya berarti upload dikonfirmasi, belum ter-index; menawarkannya akan memicu tunggu-indexing yang kontradiktif dengan semantik "dokumen yang sudah dimiliki".
7. **Highlight di-clamp (derived), bukan di-mutasi:** `mentionHighlight` adalah indeks mentah; `effectiveHighlight` derived yang di-clamp — Enter tidak pernah jatuh ke item yang sudah tidak ada di daftar filter.
