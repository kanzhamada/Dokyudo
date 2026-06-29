---
id: "dky-021"
title: "Tenant Plan Limits (FREE/PRO)"
status: pending
priority: medium
effort: medium
type: feature
phase: "b2b-security"
dependencies: ["dky-019"]
tags: ["tenant", "limits", "payments"]
created_at: 2026-06-27
---

# Tenant Plan Limits (FREE/PRO)

## Objective
Mengintegrasikan plan tier (FREE/PRO) dari tenant dan mengaplikasikan limitasi pada saat pengguna mengunggah dokumen (Document Upload) dan melakukan tanya jawab (RAG Chat). Fitur ini bergantung pada webhook pembayaran (DKY-019) yang meng-upgrade status tier tenant.

## Tasks
- [ ] Tentukan batasan untuk FREE dan PRO (contoh: max ukuran file, max total dokumen, max query chat per hari).
- [ ] Terapkan pengecekan limitasi pada `POST /api/documents/presigned-url` berdasarkan tier dari tenant.
- [ ] Terapkan pengecekan limitasi pada rute RAG Chat (Q&A).
- [ ] Kembalikan kode HTTP yang sesuai (`403 Forbidden` atau `429 Too Many Requests`) dengan standard *error envelope* aplikasi (contoh kode error: `PLAN_LIMIT_EXCEEDED`) ketika limit tercapai.

## Acceptance Criteria
- Pengguna dengan tier FREE tidak dapat melampaui batasan sistem (upload / chat).
- Pengguna dengan tier PRO dapat menikmati kapasitas maksimal sesuai spesifikasi plan.
- Sistem mengekstrak/mengecek status tier pengguna saat runtime dari database atau JWT secara efisien.
