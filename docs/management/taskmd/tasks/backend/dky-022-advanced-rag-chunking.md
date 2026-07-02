---
id: "dky-022"
title: "Implement Advanced RAG Chunking (Semantic & Small-to-Big)"
status: completed
priority: medium
effort: medium
type: feature
phase: "ingestion"
dependencies: ["dky-011", "dky-012"]
tags: ["rag","embedding","stb"]
created_at: 2026-06-27
---

# Implement Advanced RAG Chunking

## Objective
Meningkatkan kualitas RAG dari sekadar Sliding Window Chunking menjadi Advanced RAG (Small-to-Big Retrieval & Semantic Chunking) agar sistem siap untuk fase Production dengan tingkat akurasi tinggi.

## Context & Approach
Saat ini `extractor.py` menggunakan Sliding Window dengan pemotongan paksa per 1000 token dan overlap 150 token. Kita perlu menggantinya dengan:
1. **Semantic Chunking (Recursive Character Text Splitting):** Memotong teks berdasarkan batas logis manusia (paragraf, baris baru, tanda titik) untuk menghindari terpotongnya kalimat di tengah-tengah.
2. **Small-to-Big Retrieval (Parent-Child Chunking):** Memecah "Parent Chunk" besar menjadi beberapa "Child Chunks" kecil. Hanya *Child Chunk* yang akan di-embedding ke Upstash Vector, sedangkan saat ditarik (retrieval), keseluruhan *Parent Chunk* akan diambil untuk konteks LLM.

## Tasks
- [x] Refaktor `extractor.py` untuk mengimplementasikan Recursive Character Text Splitting
- [x] Buat logika pemecahan hirarkis (Parent-Child)
- [x] Ubah pipeline *embedding* agar hanya memproses *Child Chunks*
- [x] Update struktur metadata vektor di Upstash agar *Child* memegang referensi ke *Parent* ID-nya
- [x] Sesuaikan logika pencarian di API Gateway untuk menarik `Parent Chunk` penuh berdasarkan hasil referensi pencarian dari `Child Chunk`

## Acceptance Criteria
- Proses *ingestion* memotong berdasarkan batas kalimat/paragraf, bukan jumlah angka token mutlak
- API Gateway berhasil me- *retrieve* Parent Chunk penuh dari Postgres berdasarkan metadata ID di Child Chunk (Upstash)
