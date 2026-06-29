---
id: "dky-026"
title: "Smart AI Routing, Token Logic & Privacy Fallback"
status: pending
priority: high
effort: large
type: feature
phase: "rag"
dependencies: ["dky-015", "dky-025"]
tags: ["gateway","routing","llm","privacy"]
created_at: 2026-06-28
---

# Smart AI Routing, Token Logic & Privacy Fallback

## Objective
Menambahkan logika routing dinamis pada AI API Gateway. Mencakup fitur **BYOK**, **Token-based Fallback** (beragam LLM gratis), dan **Privacy Guard** untuk mencegah *Leaking PII*.

## Tasks
- [ ] **BYOK Routing**: Cek status custom API Key *tenant*. Jika ada, gunakan fungsi kriptografi (`dky-025`) untuk dekripsi di RAM dan tembak langsung ke provider mereka (OpenAI/Claude).
- [ ] **Token-Based Free Fallback**: Jika tidak ada BYOK, gunakan daftar LLM gratis (Meta Llama, Cohere Command R, Mistral, Qwen, Groq, Gemini). *Router* harus memilih model secara pintar berdasarkan jumlah panjang token konteks (misal: jika token > 32K, gunakan model dengan *context window* besar).
- [ ] **Privacy Guard (Leaking PII Prevention)**: Tambahkan opsi konfigurasi (*toggle* di sisi UI yang disimpan ke *database* per *tenant*) untuk melakukan **Exclude** pada model gratis yang menggunakan data input untuk *training* (contoh: memblokir Gemini Free API).
- [ ] Jika *toggle* privasi aktif, *router* wajib melewati model tersebut dari antrean *fallback*.

## Acceptance Criteria
- *Routing* memilih model secara otomatis berdasarkan estimasi jumlah token.
- Saat opsi "Exclude Privacy-Invasive Models" aktif, API Gateway tidak akan pernah merutekan dokumen *tenant* ke Gemini Free API (mencegah Leaking PII).
- *Fallback* bekerja sempurna saat salah satu LLM gratis mengalami *Rate Limit 429*.
