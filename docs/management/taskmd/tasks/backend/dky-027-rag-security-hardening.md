---
id: "dky-027"
title: "RAG Security Hardening (Access Control, Caching, & Integrity)"
status: completed
priority: critical
effort: medium
type: feature
phase: "security"
tags: ["security","rag","access-control"]
created_at: 2026-06-28
---

# RAG Security Hardening (Access Control, Caching, & Integrity)

## Objective
Mengamankan ekosistem RAG dari celah keamanan tingkat lanjut seperti *Access Control Gaps*, *Session Bleed*, dan *Data Poisoning* sesuai pedoman keamanan RAG.

## Tasks
- [x] **Access Control Gaps**: Pastikan `tenant_id` selalu disisipkan sebagai *hard filter* saat melakukan kueri pencarian vektor ke Upstash Vector API.
- [x] **Session Bleed Prevention**: Jika menggunakan Redis untuk *caching* jawaban LLM, wajib menggunakan format *key* yang terisolasi per pengguna (contoh: `rag_cache:{tenant_id}:{hash_prompt}`).
- [x] **Data Poisoning Mitigation (STB Worker)**: Terapkan validasi dan sanitasi ketat pada *file path* saat mengunduh dari MinIO ke `/mnt/hdd/worker_tmp` untuk mencegah celah *Path Traversal*.

## Acceptance Criteria
- Kueri RAG secara absolut terenkapsulasi dan tidak pernah membocorkan vektor milik *tenant* lain.
- *Cache hit* hanya berlaku untuk *tenant* yang sama.
- Serangan *Path Traversal* pada penamaan file PDF ditolak oleh STB Worker.
