---
id: "dky-009"
title: "Document Metadata & Upload Callback"
status: completed
priority: high
effort: small
type: feature
phase: "ingestion"
dependencies: ["dky-008"]
tags: ["postgres","metadata","webhook"]
created_at: 2026-06-26
---

# Document Metadata & Upload Callback

## Objective
Menerima konfirmasi dari klien bahwa upload selesai, lalu menyimpan metadata dokumen ke Postgres.

## Tasks
- [x] Create `POST /api/documents/confirm-upload` endpoint
- [x] Verify file exists in MinIO
- [x] Update `documents` table with `status = 'confirmed'`

## Acceptance Criteria
- Metadata successfully written to Postgres
- Returns error if object does not exist in MinIO bucket
