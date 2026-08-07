# Laporan Optimasi & Benchmark Sistem RAG Dokyudo

**Periode:** 6–7 Agustus 2026
**Scope:** `apps/backend` (pipeline search + chat), `apps/stb-worker` (ingest/embedding), `apps/frontend` (minor)
**Metode:** eksperimen berkelanjutan berbasis benchmark (ukur → pertahankan yang menang → buang yang tidak membantu)

---

## 1. Ringkasan Eksekutif

Empat perubahan utama dilakukan pada sistem RAG:

| # | Perubahan | Jenis | Dampak |
|---|---|---|---|
| 1 | **Benchmark harness** (eval set 47 query, metrik recall@k/MRR@k/latency) | Infrastruktur baru | Semua keputusan berikutnya berbasis data, bukan feeling |
| 2 | **Refactor RRF** menjadi fungsi murni + mode sweep | Refactor kode | Perilaku produksi tidak berubah; eksperimen jadi murah (1 fetch utk banyak konfigurasi) |
| 3 | **Tuning bobot fusi: `fts=2, vec=1`** (sebelumnya 1:1) | Perhitungan | MRR@1 naik 61.3% → 80.6% (sweep 31 query) |
| 4 | **Migrasi model embedding: qwen3-embedding-0.6b → bge-m3** | Model | MRR@1 80.8% → 85.1%; recall@1 65.4% → 69.7%; kasus cross-lingual diperbaiki |

**Hasil akhir (korpus terbaru, 47 query):** recall@1 **80.1%**, recall@3 **96.8%**, recall@5 **100%**, MRR@1 **87.2%**, MRR@3 **92.9%**, latency p50 **~1.0 detik**.

**Biaya:** $0 (semua memakai kapasitas gratis yang sudah ada: Postgres FTS, Upstash free tier, Cloudflare Workers AI; re-embed 2.045 chunk ≈ $0.007 di harga list).

**Yang TIDAK berubah:** alur produksi (hybrid FTS+vector + RRF), endpoint/API, schema DB, dimensi vektor (1024), arsitektur chat/SSE.

---

## 2. Perubahan yang Dilakukan

### 2.1 Benchmark Harness (baru) — `apps/backend/benchmark/`

| File | Fungsi |
|---|---|
| `run_benchmark.ts` | Skrip utama: jalankan pipeline produksi terhadap eval set, hitung recall@k / MRR@k / latency; mode single-config & sweep (`--configs`) |
| `metrics.ts` (+ `metrics.test.ts`) | Fungsi metrik murni (uniqueDocumentIds, recallAtK, mrrAtK, mean, percentile) — teruji 4+6 kasus |
| `eval_set.json` | Golden set: 47 query (31 keyword awal + 8 semantik/parafrase + 8 cross-lingual ID↔EN) dengan `expectedDocumentIds` |
| `list_documents.ts` | List dokumen tenant + pratinjau chunk (untuk menyusun eval set) |
| `bge_m3_test.ts` / `fuse_bge3.ts` | A/B model embedding (vector-only & fusi FTS+BGE-M3) di namespace terpisah |
| `fts_rank_test.ts` | Uji fungsi ranking FTS murni (ts_rank / ts_rank_cd / normalisasi) |
| `migrate_bge3.ts` | Re-embed chunk dengan model baru ke namespace produksi (id & metadata identik) |
| `README.md` | Panduan pakai + catatan pitfall |

Task Deno terdaftar: `benchmark`, `benchmark:list`, `benchmark:bge3`, `benchmark:bge3-fuse`, `benchmark:fts-rank`, `benchmark:migrate-bge3`.

Catatan desain penting:
- **`skipQuota`** (param internal, hanya dari benchmark): benchmark tidak menghabiskan kuota search produksi tenant.
- **Sweep 1-fetch**: `executeHybridSearchForConfigs` menghitung banyak konfigurasi fusi dari satu fetch — 6 konfigurasi = 1× biaya quota/API.
- Hasil disimpan di `benchmark/results/` (gitignored bersama `eval_set.json`).

### 2.2 Refactor Fusion RRF — `src/modules/search/rrf.ts` (baru) + `search.service.ts` + `search.schema.ts`

- Logika RRF diekstrak ke fungsi murni `fuseWithRRF(vector, fts, {k, ftsWeight, vectorWeight})` + `DEFAULT_FUSION`.
- `executeHybridSearchForConfigs()` — sweep banyak konfigurasi dalam satu fetch.
- Field opsional `rrfK`, `ftsWeight`, `vectorWeight`, `fusionConfigs`, `skipQuota` di `SearchParamsSchema` (internal; endpoint HTTP tidak terpapar — `SearchQuerySchema` hanya berisi `query` & `limit`).
- Unit test: `rrf.test.ts` (6 test) — memverifikasi perilaku asli (1:1, k=60) tetap direproduksi.
- **Refactor ini tidak mengubah perilaku produksi** (default awal = persis kode lama).

### 2.3 Tuning Bobot Fusi — perubahan perhitungan

- **Sebelum:** RRF k=60, bobot FTS:vector = 1:1.
- **Sesudah:** RRF k=60, bobot **FTS:vector = 2:1** (`DEFAULT_FUSION` di `rrf.ts`).
- Keputusan dari sweep 31 query: k ∈ {10,30,60,100} **tidak berpengaruh**; bobot vector lebih besar **merusak** (recall@5 91.9% → 68.5%); FTS lebih berat **menaikkan** MRR@1 61.3% → 80.6%.
- Satu regresi minor saat itu: `bni-title` rank 1→2 (masih top-2).

### 2.4 Migrasi Model Embedding — qwen3 → BGE-M3

| Aspek | Sebelum | Sesudah |
|---|---|---|
| Model | `@cf/qwen/qwen3-embedding-0.6b` | `@cf/baai/bge-m3` |
| Dimensi | 1024 (L2-norm 1.0) | 1024 (L2-norm 1.0) — **index Upstash tidak dibangun ulang** |
| API shape | `{"text": [...]}` | sama |
| Kesamaan lintas-bahasa (ID↔EN makna sama) | 0.800 | **0.881** |
| Konteks model | 8.192 token | 60.000 token |

File berubah:
- `apps/backend/src/config/cloudflare.ts` — model embedding query
- `apps/stb-worker/core/config.py` — `CF_EMBEDDING_MODEL` (ingest; `BATCH_SIZE=32` sudah aman utk konteks 60K)

Eksekusi: re-embed 2.045 chunk → upsert ke namespace produksi (id + metadata `{tenantId, documentId, chunkIndex, pages, content}` identik dengan payload worker) via `benchmark:migrate-bge3`.

### 2.5 Perubahan pendukung

- **Frontend** (sesi awal): `apps/frontend/src/lib/utils/doc-references.ts` (baru) — ekstrak logika merge/dedupe referensi dokumen panel chat menjadi fungsi murni + unit test Deno (`tests/unit/doc-references.test.ts`); hapus filter referensi duplikat di `+page.svelte` (server sudah memfilter).
- `.gitignore`: tambah `apps/backend/benchmark/eval_set.json` + `benchmark/results/`.

---

## 3. Flow / Perhitungan / Model yang Berubah

| Aspek | Sebelum | Sesudah | Berubah? |
|---|---|---|---|
| Alur retrieval (scatter: FTS + vector → RRF → fetch content) | ya | ya | **Tidak** |
| Graceful degradation (salah satu sumber gagal → tetap jalan) | ya | ya | **Tidak** |
| Cache embedding Redis (30 hari, key per model) | ya | ya | Tidak (key otomatis baru utk model baru) |
| Circuit breaker embedding | ya | ya | Tidak |
| Quota search per query | ya | ya | Tidak (benchmark pakai `skipQuota`) |
| Bobot fusi RRF | 1:1 | **2:1 (FTS)** | **Ya** |
| Konstanta RRF `k` | 60 | 60 | Tidak |
| Model embedding | qwen3-0.6b | **bge-m3** | **Ya** |
| Dimensi vektor / index | 1024 | 1024 | Tidak |
| Endpoint / schema DB / skema API | — | — | Tidak |
| Gatekeeper prompt injection, query rewrite, fallback LLM pool | ya | ya | Tidak |

---

## 4. Progres Benchmark (dari awal hingga akhir)

Semua angka dari laporan tersimpan di `benchmark/results/`. Eval set berkembang 31 → 47 query; korpus berubah di tahap akhir (re-ingest). Persentase = rata-rata 47 kasus (31 kasus utk tahap awal).

| # | Tahap | Kasus | recall@1 | recall@3 | recall@5 | MRR@1 | MRR@3 | Lat p50 |
|---|---|---|---|---|---|---|---|---|
| 1 | Baseline awal — qwen3, k=60, 1:1 (cache dingin) | 31 | 50.0% | 85.5% | 91.9% | 61.3% | 76.9% | 1.99s |
| 2 | Baseline sama (cache hangat) | 31 | 50.0% | 85.5% | 91.9% | 61.3% | 76.9% | 1.33s |
| 3 | **Sweep fusi** (31q): k=10/30/60/100 (1:1) | 31 | 50.0% | 85.5% | 91.9% | 61.3% | 76.9% | — |
| 3a | **Sweep fusi: fts=2, vec=1** | 31 | **66.1%** | **91.9%** | **93.5%** | **80.6%** | **88.2%** | — |
| 3b | Sweep fusi: fts=1, vec=2 (buruk → ditolak) | 31 | 50.0% | 67.7% | 68.5% | 61.3% | 65.6% | — |
| 4 | Ablation (31q): vector-only | 31 | 47.6% | 66.9% | 68.5% | 61.3% | 65.6% | — |
| 5 | Eval set 47q: hybrid fts=2 | 47 | 65.4% | 87.2% | 93.1% | 80.9% | 85.8% | 1.06s |
| 6 | **FTS murni** (test fungsi ranking): ts_rank | 47 | 47.9% | 58.5% | 59.6% | 57.4% | 59.6% | — |
| 7 | BGE-M3 vector-only (A/B) | 47 | 61.2% | 75.5% | 77.7% | 74.5% | 76.6% | — |
| 8 | **BGE-M3 + FTS (fusi, terkoreksi)** | 47 | **69.2%** | **91.5%** | **93.1%** | **83.0%** | **89.0%** | — |
| 9 | **Pasca-migrasi BGE-M3** (produksi) | 47 | 69.7% | 90.4% | 93.1% | 85.1% | 89.7% | 1.32s |
| 10 | Run ulang pasca-migrasi | 47 | 70.2% | 91.5% | 93.1% | 83.0% | 89.0% | 1.01s |
| 11 | Pasca **re-ingest** (eval set usang → 0%) | 47 | 0% | 0% | 0% | 0% | 0% | 1.10s |
| 12 | **Final** — eval set di-remap ke id baru | 47 | **80.1%** | **96.8%** | **100%** | **87.2%** | **92.9%** | 0.99s |

Catatan tahap 6 & 12:
- Tahap 6 mengoreksi artefak ablation (lihat §6): FTS murni ternyata **sumber terlemah**; "FTS-only == hybrid" pada tahap 4–5 adalah artefak padding skor 0.
- Tahap 11–12: re-ingest membuat UUID dokumen baru; golden ids usang → 0%. Setelah remap, angka naik signifikan (sebagian karena duplikat dokumen terkonsolidasi: CV 2→1, IDeA 4→1, dll.) — **angka tahap 1–10 vs 12 tidak sebanding sempurna** karena korpus & eval set berubah.

Kasus kunci di tahap final (semua rank 1): `kanz-ar`, `xl-kanz-id`, `xl-kanz-en`, `sem-kanz` (dokumen Framer, cross-lingual), `bank-acc` (nomor rekening), `bni-gov` (tata kelola).

---

## 5. Dampak

### Kualitas retrieval
- MRR@1: 61.3% → **87.2%** (+25.9pp dari awal; +6.3pp dari pasca-migrasi).
- recall@5: 91.9% → **100%** (semua dokumen golden muncul di top-5).
- Cross-lingual (query ID ↔ dokumen EN): `kanz-ar` dulu **miss total**, kini rank 1.

### Latency
- Steady-state p50 ~1.0 detik (avg ~1.0–1.5s), p95 ~1.05s. Tidak ada degradasi berarti dari penambahan apa pun (fusi & model sama-sama 1 embedding call, di-cache Redis 30 hari).

### Storage & biaya
- Vektor: **tidak membengkak** — 1024-dim sama, jumlah chunk tetap (~2.045), index tidak dibangun ulang.
- Redis: entri cache embedding model lama menganggur (key per model, TTL 30 hari) — sepele.
- Token: tidak ada perubahan konsumsi LLM (retrieval tidak menyentuh token generasi).
- Biaya: $0; re-embed 2.045 chunk ≈ $0.007 (harga list CF).

### Trade-off / risiko
- Keputusan berbasis **47 query × 1 tenant** — indikatif, bukan konklusif; perlu eval set diperluas dari penggunaan nyata.
- `fts=2` dioptimalkan utk korpus laporan tahunan Indonesia; jika domain berubah, ulangi sweep.
- BGE-M3 unggul lintas-bahasa tapi satu kasus istilah teknis ("realitas tertambah") sempat miss di tahap 8 — kini ter-cover setelah re-ingest.

---

## 6. Insiden & Pelajaran

1. **Artefak padding (ablation)** — config `fts=0`/`vec=0` pada laporan sweep menyimpan *hasil akhir fusi*; saat satu sumber punya < limit match, list di-pad dengan chunk sumber lain berskor 0. Ini membuat "FTS-only == hybrid" terlihat benar padahal FTS murni justru terlemah. → Jangan gunakan config tersebut sebagai metrik sumber murni; pakai `benchmark:fts-rank` (SQL langsung) untuk FTS murni.
2. **Eval set usang setelah re-ingest** — re-ingest membuat UUID dokumen baru → `expectedDocumentIds` tidak lagi ada → recall 0% total (bukan regresi model). → Remap golden ids via judul dokumen setelah re-ingest (README sudah dicatat).
3. **Bug remap** — skrip remap menghasilkan array bersarang (`[[uuid]]`) → metrik tetap 0% walau id benar. → Validasi struktur eval set (array datar string).

---

## 7. Artefak & Reproduksi

- Semua laporan JSON: `apps/backend/benchmark/results/` (baseline-, sweep-, bge-m3-, bge3-fusion-, fts-rank-).
- Eval set: `apps/backend/benchmark/eval_set.json` (+ backup `eval_set.json.bak`).
- Cara menjalankan (dari `apps/backend`):

```bash
# Baseline produksi saat ini
deno task benchmark -- --tenant <TENANT_ID>

# Sweep konfigurasi fusi (1 fetch per query)
deno task benchmark -- --tenant <TENANT_ID> --configs '[{"k":60,"ftsWeight":2,"vectorWeight":1}, ...]'

# FTS murni / A/B model / migrasi
deno task benchmark:fts-rank -- --tenant <TENANT_ID>
deno task benchmark:bge3 -- --tenant <TENANT_ID>
deno task benchmark:bge3-fuse -- --tenant <TENANT_ID>
deno task benchmark:migrate-bge3 -- --tenant <TENANT_ID>
```

- Unit test: `deno test src/modules/search/rrf.test.ts` (6), `benchmark/metrics.test.ts` (4); test service & rag tetap lulus (8 test / 24 step).

---

## 8. Rekomendasi Lanjutan (berbasis data)

- **Perluas eval set** ke ≥50 query dari log penggunaan nyata (termasuk query parafrase & cross-lingual) — dasar keputusan berikutnya.
- **Re-ranking**: gap MRR@1 (87%) masih menyisakan ruang; keputusan privat (self-host di STB worker) vs eksternal (Cohere) — baru dievaluasi jika korpus tumbuh.
- **Kembali uji BGE-M3 vs alternatif** jika korpus menjadi dominan dokumen English-only.
- **Audit komposisi bahasa korpus** secara berkala — menentukan relevansi model multilingual.
