---
id: "dky-010"
title: "Supabase pg_net Webhook Trigger"
status: completed
priority: high
effort: small
type: feature
phase: "ingestion"
dependencies: ["dky-009"]
tags: ["supabase","trigger","pg-net"]
created_at: 2026-06-26
---

# Supabase pg_net Webhook Trigger

## Objective
Menulis migrasi SQL untuk membuat trigger `pg_net` yang mengirim webhook ke STB saat dokumen baru masuk.

## Tasks
- [x] Enable `pg_net` extension in Supabase
- [x] Write PL/pgSQL function to construct HTTP payload
- [x] Attach `AFTER UPDATE` trigger on `documents` table
- [x] Target the STB Worker's Cloudflare Tunnel URL

## Acceptance Criteria
- Inserting a row automatically triggers an HTTP POST request
- Payload includes `document_id` and `tenant_id`
