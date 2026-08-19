# Update Tenant Name Endpoint Documentation

**Completion Timestamp**: 2026-08-19T13:45:34+07:00

> **Note**: This endpoint was originally located at `PATCH /api/auth/tenant/name` and has been relocated to `PATCH /api/me/tenant/name` as part of the modular monolith refactoring into the dedicated `me` module.

## Core Logic

The `PATCH /api/me/tenant/name` endpoint allows an authenticated user to update their workspace's display name. The operation executes inside a `withAuthDb` transaction to enforce Supabase Row-Level Security (RLS), ensuring users can only modify their own tenant record in the `tenants` table.

Upon completion, an audit log entry (`tenant.name_updated`) is recorded in `activity_logs` with `clientIp` and `userAgent` metadata extracted via `ContextExtractor.extractAuditContext()`.

---

## Flow Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User as Client / User
    participant Frontend as SvelteKit UI
    participant Backend as Dokyudo API Gateway (/api/me)
    participant Extractor as ContextExtractor
    participant DB as Postgres (RLS)

    User->>Frontend: Submit new workspace name
    Frontend->>Backend: PATCH /api/me/tenant/name { name }
    Backend->>Extractor: extractAuthContext(c) & extractAuditContext(c)
    Extractor-->>Backend: { userId, tenantId, clientIp, userAgent }

    Backend->>DB: withAuthDb(userId) — set role authenticated
    DB->>DB: Check tenant existence
    DB->>DB: UPDATE tenants SET name, updated_at WHERE id = tenantId RETURNING id, name
    Backend->>DB: INSERT INTO activity_logs (tenant.name_updated, clientIp, userAgent)

    Backend-->>Frontend: 200 OK { tenant: { id, name }, message }
```

---

## File Mapping

| File | Purpose / Changes |
|---|---|
| `apps/backend/src/shared/models/db.model.ts` | `tenants` table definition with `updated_at` column. |
| `apps/backend/src/modules/me/me.schema.ts` | Defined `UpdateTenantNameBodySchema`, `UpdateTenantNameParams` (including optional `clientIp` and `userAgent`), and `UpdateTenantNameResponseSchema`. |
| `apps/backend/src/modules/me/me.service.ts` | Implemented `static async updateTenantName(params: MeParams.UpdateTenantNameParams)` using `withAuthDb` and `logActivity()`. |
| `apps/backend/src/modules/me/me.controller.ts` | Implemented `handleUpdateTenantName` using `ContextExtractor` to pull `userId`, `tenantId`, `clientIp`, and `userAgent`. |
| `apps/backend/src/modules/me/me.routes.ts` | Exposed `PATCH /tenant/name` route under `meRoutes` (mounted at `/api/me/tenant/name`). |
| `apps/backend/src/modules/me/me.service.test.ts` | Unit tests covering `updateTenantName` (positive and negative execution paths). |
| `apps/frontend/src/lib/api/me.ts` | `updateTenantName` API client function calling `/api/me/tenant/name`. |
| `api-collections/Me/05_Update Tenant Name.bru` | Bruno collection request file for the endpoint. |

---

## Connections

- **Database**: The update is executed inside `withAuthDb(userId)` which sets `role = authenticated` and injects `request.jwt.claims = { sub: userId }`.
- **Audit Trail**: Emissions to `activity_logs` record `tenant.name_updated` alongside `clientIp` and `userAgent` extracted from request proxy headers.

---

## Architectural Decisions

1. **`withAuthDb` over bare `db`**: All tenant-scoped mutations run inside an `authenticated` RLS session to maintain multi-tenancy isolation contracts.
2. **Audit Context Extraction**: `handleUpdateTenantName` extracts `clientIp` and `userAgent` via `ContextExtractor.extractAuditContext()` and passes parameters to `MeService.updateTenantName`.
3. **`.returning()`**: Retrieves the updated name in the same DB round-trip, avoiding redundant `SELECT` queries after `UPDATE`.
4. **Schema-First**: Zod schemas in `me.schema.ts` serve as the single source of truth for both runtime validation and auto-generated OpenAPI specs.
