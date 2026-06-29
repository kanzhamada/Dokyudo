---
id: "dky-020"
title: "7-Day Teardown Cron Jobs"
status: pending
priority: medium
effort: small
type: chore
phase: "b2b-security"
dependencies: []
tags: ["cron","security","cleanup"]
created_at: 2026-06-26
---

# 7-Day Teardown Cron Jobs

## Objective
Tugas terjadwal untuk menghapus file MinIO dan vektor Upstash yang berumur lebih dari 7 hari.

## Tasks
- [ ] Create `DELETE /api/admin/teardown-stale` endpoint
- [ ] Implement logic to scan and delete old MinIO objects
- [ ] Implement logic to delete old Upstash Vector IDs
- [ ] Schedule QStash to hit endpoint daily

## Acceptance Criteria
- Items >7 days old are permanently purged
- Endpoint requires strict admin API key authentication
