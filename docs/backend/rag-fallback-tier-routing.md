# RAG Fallback Tier & Model Routing (Free Auto)

## 1. Core Logic

Sistem free-tier (tanpa BYOK) memilih **tier model pool** berdasarkan kompleksitas request, lalu merotasi provider dalam pool tersebut sampai satu berhasil streaming. Dokumen ini mencatat perombakan klasifikasi tier (dari "selalu MEDIUM" menjadi berbasis depth + skor), pemilihan model yang dipindah ke pre-stream, dan log rantai fallback.

## 2. Masalah Awal: "Selalu MEDIUM"

Gejala di log: `estimatedTokens` selalu ~4.5–4.6K dan `fallbackTier` selalu `MEDIUM`, bahkan untuk pertanyaan 4 kata.

Akar masalah:
- `estimateTokenCount(augmentedPrompt)` menghitung **seluruh prompt** (instruksi + konteks RAG + history + pertanyaan).
- Konteks RAG (5 chunk ≈ 4.2K token) **near-konstan** karena dibatasi limit search.
- Total token selalu di band 4.5–7K → `LIGHT_MAX = 4000` berada **di bawah ukuran minimum prompt RAG** → LIGHT tidak pernah terpicu → semuanya MEDIUM.
- Panjang pertanyaan (satu-satunya yang bervariasi) tenggelam oleh konteks.

Kesimpulan: klasifikasi berbasis total token tidak pernah menghasilkan variasi karena inputnya sendiri hampir konstan.

## 3. Formula Klasifikasi (`selectTier`)

Sinyal utama = **kedalaman history conversation** (0–3 turn sebelumnya) — variabel yang benar-benar mengubah ukuran prompt dan kompleksitas konteks yang harus dibawa model. Depth di-refine oleh **skor kompleksitas**:

```
score = questionTokens + historyTokens + contextTokens × 0.1

depth 0 → LIGHT
depth 1 → score ≤ 500  → LIGHT   |  else → MEDIUM
depth 2 → score ≤ 1500 → MEDIUM  |  else → HEAVY
depth 3 → HEAVY

Guard (override semua, dicek duluan):
  totalTokens  > 30K   → HEAVY   (hard budget)
  contextTokens > 12K  → HEAVY   (konteks raksasa)
  questionTokens > 200 → HEAVY   (pertanyaan sangat panjang)
```

**Rasional bobot**: token pertanyaan + history diberi bobot penuh (model *menalar* di atasnya); token konteks di-diskon (terbatas oleh search limit, sebagian besar "membaca" bukan "menalar" — kapabilitas tetap dijaga guard terpisah). `selectTier` murni O(1) — semua input sudah dihitung sebelumnya.

**Input** (dihitung di `rag.service.ts`):
- `historyDepth` = `previousTurns.length` (turn complete saja, dari query history).
- `questionTokens` = `estimateTokenCount(question)`.
- `historyTokens` = `estimateTokenCount(historyText)`.
- `contextTokens` = `estimateTokenCount(contextText)`.
- `totalTokens` = estimasi prompt penuh (dihitung di `generateStream` dari `fullText`).

**Threshold tunable** (konstanta): `TIER_SCORING.CONTEXT_WEIGHT = 0.1`, `DEPTH1_LIGHT_MAX = 500`, `DEPTH2_MEDIUM_MAX = 1500`, `GUARD_THRESHOLDS.{QUESTION_HEAVY_MIN_TOKENS=200, CONTEXT_HEAVY_MIN_TOKENS=12_000}`, `TIER_THRESHOLDS.HEAVY_MAX = 30_000`.

## 4. Pemilihan Model Pre-Stream

Pemanggilan `FallbackLlmService.generateStream` (system mode) dipindah **sebelum** `ReadableStream` dikonstruksi. Alasannya: middleware log (`logger.middleware.ts`) menulis `http_request` saat handler return — untuk SSE itu terjadi **sebelum** `start()` berjalan, sehingga `fallbackChain`/`selectedModel` (yang sebelumnya di-set di dalam `start()`) tidak pernah masuk log.

- Abort selama seleksi → `abortAsStopped()` (turn jadi `stopped`).
- Seleksi gagal total → `finalizeTurn("failed")` + error stream HTTP 200 (perilaku sama dengan in-stream sebelumnya, frontend tidak berubah).
- `finalizeTurn`, `references`, `successfulModel`, `startMs`, `modelUsedFallback` di-hoist ke scope `streamChat` agar bisa dipakai pre-stream dan in-stream.
- `latency_ms` di DB kini **termasuk waktu seleksi model** (sebelumnya hanya waktu stream) — angka lebih jujur.

## 5. `fallbackChain` (Log Rantai Model)

Array terstruktur berurutan — setiap kandidat yang dicoba, berakhir dengan yang sukses:

```json
"fallbackChain": [
  { "provider": "groq", "modelId": "meta-llama/llama-4-scout-17b-16e-instruct", "outcome": "circuit_open" },
  { "provider": "gemini", "modelId": "gemini-3.1-flash-lite", "outcome": "success" }
]
```

- `outcome`: `circuit_open` | `quota_exhausted` | `failed` (+ `error`) | `success`.
- **Entri terakhir = model yang sukses = persis `model_used` di DB** — log dan database konsisten.
- Ditulis saat sukses **dan** saat semua kandidat habis (sebelum throw).
- Key `{provider}_error`, `selectedProvider`, `selectedModel` dihapus — informasinya sudah ada di chain (satu sumber kebenaran).

## 6. Ekstraksi Pesan Error per Provider

Pesan error di `fallbackChain[].error` diambil sesuai sumbernya:

- **Fetch-based (Groq / SambaNova / Cohere)**: saat `!res.ok`, body respons API dibaca via `extractApiError()` (JSON `error.message` dulu, fallback raw text, 250 char) → contoh `"Groq 429: You are currently rate limited..."`.
- **SDK-based (Gemini / Mistral)**: `providerErrorMessage()` memakai native error SDK, prefix `[status]` kalau numerik, dipotong 300 char.

## 7. File Mapping

- `apps/backend/src/shared/constants/free_model_pool.constant.ts`: `selectTier` (depth + skor), `TIER_SCORING`, `GUARD_THRESHOLDS`, pool LIGHT/MEDIUM/HEAVY.
- `apps/backend/src/modules/rag/fallback_llm.service.ts`: `generateStream` (terima `historyDepth`/`questionTokens`/`historyTokens`/`contextTokens`, log breakdown + `fallbackChain`), `extractApiError`, `providerErrorMessage`, error enrichment di fetch providers.
- `apps/backend/src/modules/rag/rag.service.ts`: hitung `historyDepth` + token komponen, pemilihan model pre-stream (5.2), hoist `finalizeTurn`.
- `apps/backend/src/shared/constants/free_model_pool.constant.test.ts`: unit test `selectTier`.

## 8. Completion Timestamp

**Tier berbasis total → depth + skor:** 2026-08-07  
**Pre-stream selection + fallbackChain log:** 2026-08-07  
**Error extraction per provider:** 2026-08-07
