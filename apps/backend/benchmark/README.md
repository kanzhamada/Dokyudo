# RAG Retrieval Benchmark (Baseline Harness)

Mengukur kualitas retrieval pipeline produksi saat ini (`SearchService.executeHybridSearch`:
tsvector FTS + Upstash Vector + RRF) menggunakan **golden evaluation set**, dan melaporkan
**recall@k**, **MRR@k**, dan **latency**.

Tujuan: menghasilkan baseline data (bukan feeling) untuk keputusan chunking berikutnya
(mis. small-to-big / page-context, chunk size 512 vs 1000, re-ranking).

## Prasyarat

- `.env` backend valid & terenkripsi dotenvx (berisi `DATABASE_URL`, `SUPABASE_*`,
  `UPSTASH_VECTOR_*`, `UPSTASH_REDIS_*`, `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_AUTH_TOKEN`
  untuk embedding).
- Tenant yang berisi dokumen yang mau dievaluasi.

## 1. Buat eval set

```bash
cp benchmark/eval_set.template.json benchmark/eval_set.json
```

Isi `cases[]` dengan query nyata + `expectedDocumentIds` (UUID dokumen yang **harus**
muncul di hasil retrieval untuk query tersebut):

- Target **30–50 query** untuk baseline yang berarti (skrip memberi warning jika < 30).
- Campur tipe query: keyword-heavy (nomor invoice, kode, pasal, istilah spesifik),
  konseptual/semantik, dan pertanyaan lintas dokumen.
- Cara mendapatkan document id: query tabel `documents` di Supabase, atau
  `GET /api/documents` (auth) untuk tenant tersebut.
- Opsional: isi `expectedChunkIds` untuk metrik chunk-level (lebih ketat; default
  evaluasi di level dokumen).

`eval_set.json` dan `benchmark/results/` sudah di-`.gitignore` — jangan commit data
query/dokumen yang sensitif.

## 2. Jalankan

```bash
cd apps/backend
deno task benchmark -- --tenant <TENANT_ID>
```

Opsional:

```bash
deno task benchmark -- --tenant <TENANT_ID> --eval-set ./benchmark/eval_set.json --ks 1,3,5,10 --limit 10
```

Sweep fusion (banyak konfigurasi RRF dalam **satu fetch per query** — hemat kuota,
satu config = nol tambahan quota):

```bash
deno task benchmark -- --tenant <TENANT_ID> --configs '[
  {"k":10},{"k":30},{"k":60},{"k":100},
  {"k":60,"ftsWeight":2},{"k":60,"vectorWeight":2}
]'
```

Single config alternatif: `--k 60 --fts-weight 1 --vector-weight 1` (default
produksi saat ini: `k=60, fts=2, vec=1` — hasil data sweep; lihat `rrf.ts`).

Fallback env: `BENCHMARK_TENANT_ID`, `BENCHMARK_EVAL_SET`.

## 3. Output

- Ringkasan ke stdout: `recall@k`, `mrr@k`, latency avg/p50/p95, durasi total,
  jumlah kegagalan sumber (FTS / vector).
- Laporan JSON lengkap (per-query) ke `benchmark/results/baseline-<timestamp>.json`.

## Catatan penting

- **Benchmark memakai `skipQuota`** — tidak menghabiskan kuota search tenant
  (kuota tetap ditegakkan di endpoint HTTP produksi).
- **Jangan menyimpulkan kekuatan sumber dari config `fts=0`/`vec=0` di laporan
  sweep**: list hasil akhir bisa berisi padding skor 0 dari sumber lain saat
  sumber utama punya < limit match. Untuk metrik sumber murni pakai
  `deno task benchmark:fts-rank` (FTS murni via SQL) / query namespace langsung.
- **Run pertama lebih lambat**: embedding di-cache di Redis (TTL 30 hari); run
  berikutnya mendekati steady-state latency.
- Skrip **tidak mengubah perilaku produksi** — hanya memanggil fungsi search yang sama
  dengan endpoint chat/search (kecuali kuota yang sengaja dilewati untuk benchmarking).

## Metrik yang dihitung

- **recall@k** = proporsi dokumen golden yang muncul di top-k hasil (level dokumen,
  urutan kemunculan pertama).
- **MRR@k** = kebalikan peringkat dokumen golden pertama di top-k (1/rank; 0 jika tidak muncul).
- **Latency** = durasi `executeHybridSearch` (inkl. FTS + vector + RRF; embedding
  mungkin dari cache).

## Interpretasi & langkah berikutnya

- recall@5 / mrr@5 rendah pada query keyword-heavy → indikasi untuk memprioritaskan
  jalur FTS (adaptive-lite) atau re-check chunking.
- recall@5 rendah merata → kandidat eksperimen small-to-big / page-context (simpan
  page text utuh saat ingest, retrieve chunk kecil, kirim full page ke LLM) lalu
  bandingkan head-to-head dengan baseline ini.
- Setiap eksperimen: simpan laporan JSON dengan nama berbeda, bandingkan metrik,
  jangan ubah konfigurasi produksi tanpa data.
