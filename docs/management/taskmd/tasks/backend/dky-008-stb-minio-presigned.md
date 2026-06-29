---
id: "dky-008"
title: "MinIO Presigned URL Generation"
status: completed
priority: high
effort: small
type: feature
phase: "ingestion"
dependencies: ["dky-003"]
tags: ["minio","s3","upload"]
created_at: 2026-06-26
---

# MinIO Presigned URL Generation

## Objective
Membuat endpoint yang men-generate Presigned URL (PUT) MinIO agar klien bisa upload langsung secara aman.

## Tasks
- [x] Integrate AWS S3 SDK for MinIO connection
- [x] Create `POST /api/documents/presigned-url` endpoint
- [x] Generate secure PUT URL with 15-minute expiration
- [x] Enforce tenant-isolated object keys (e.g. `tenant_id/doc_id.pdf`)

## Acceptance Criteria
- Returns valid S3 presigned URL
- URL strictly enforces the tenant directory path
