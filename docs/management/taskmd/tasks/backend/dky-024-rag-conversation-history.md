---
id: "dky-024"
title: "RAG Conversation History Scope"
status: pending
priority: medium
effort: medium
type: feature
phase: "rag"
dependencies: ["dky-016"]
tags: ["database","drizzle","state"]
created_at: 2026-06-28
---

# RAG Conversation History Scope

## Objective
Mengelola sesi tanya jawab agar RAG dapat mengingat konteks chat sebelumnya melalui `conversations` dan `conversation_turns`.

## Tasks
- [ ] Buat atau sesuaikan schema tabel `conversations` dan `conversation_turns` (lengkap dengan `tenant_id`)
- [ ] Implementasikan Drizzle ORM query untuk menyimpan setiap pertanyaan dan jawaban
- [ ] Simpan metadata (model yang dipakai, latency, id chunk konteks) ke `conversation_turns`
- [ ] Ambil `conversation_id` opsional dari input client, jika tidak ada, buat baru

## Acceptance Criteria
- Tiap turn tercatat di database dengan `tenant_id`
- User dapat melanjutkan percakapan berdasarkan `conversation_id`
