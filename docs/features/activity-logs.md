# Activity Logs & Audit Trail Feature Documentation

**Completion Timestamp**: 2026-07-31T16:56:00+07:00 (WIB)

## Core Logic

The Activity Logs system provides a comprehensive audit trail and user activity feed for all significant operations within a tenant's workspace. It records authentication events, document operations, payment transactions, and system failures, enabling workspace members and administrators to monitor account security, verify background tasks, and maintain compliance.

### Key Capabilities
1. **Audit Context Extraction**: Every backend controller extracts client IP addresses (`x-forwarded-for`, `x-real-ip`, `cf-connecting-ip`), user-agent strings, and request IDs via `ContextExtractor.extractAuditContext()` and passes them down to the service layer.
2. **Denormalization via Metadata (JSONB)**: Specific event snapshot metadata (e.g., file names, subscription tiers, payment amounts, failure reasons) is stored in a JSONB column at event emission time, guaranteeing log immutability even if the target resource is deleted later.
3. **Selective Business Failure Audit Logging**: In addition to successful operations (`document.uploaded`, `billing.payment_completed`), business-level processing failures (`document.failed`, `document.quota_exhausted`, `billing.payment_failed`) are recorded so users have visibility into background pipeline outcomes.
4. **Tenant Isolation & SQL-Indexed Filtering**: Every query is strictly scoped to `tenant_id` to enforce multi-tenancy data isolation. Supports server-side dynamic SQL filtering by category (`auth`, `document`, `billing`, `tenant`), date range (`startDate`, `endDate`), and search query (`action`, `metadata`, `ipAddress`) backed by a composite index `(tenant_id, action, created_at DESC)`.
5. **Interactive Frontend Presentation**: The Svelte 5 frontend renders logs using TanStack Table and shadcn-svelte `Table` primitives, complete with a filter toolbar (Search input, category buttons, date range inputs, reset trigger), parsed User-Agent strings, relative timestamps with tooltips, and status dot indicators.

---

## Flow Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User as Client / User
    participant FE as SvelteKit Activity Page
    participant API as Hono Router & Controller
    participant Extractor as ContextExtractor
    participant Service as Business Service
    participant DB as PostgreSQL (activity_logs)

    rect rgb(30, 41, 59)
    note over User,DB: 1. Audit Context Extraction & Logging Flow
    User->>API: HTTP Request (e.g. POST /api/documents/confirm)
    API->>Extractor: extractAuditContext(c)
    Extractor-->>API: { clientIp, userAgent, requestId }
    API->>Service: confirmUpload({ tenantId, documentId, clientIp, userAgent })
    Service->>DB: INSERT INTO activity_logs (tenant_id, action, ip_address, user_agent, metadata)
    Service-->>API: Success Response
    API-->>User: 200 OK
    end

    rect rgb(15, 23, 42)
    note over User,DB: 2. Activity Feed Retrieval & Filter Flow
    User->>FE: Select Category "Documents" & Enter Search Query
    FE->>API: GET /api/activities?page=1&limit=15&category=document&search=harum
    API->>Extractor: extractAuthContext(c) & extractValidQuery()
    API->>Service: getActivities({ tenantId, page: 1, limit: 15, category, search })
    Service->>DB: SELECT * FROM activity_logs WHERE tenant_id = ? AND action LIKE 'document.%' AND LOWER(metadata::text) LIKE '%harum%' ORDER BY created_at DESC
    DB-->>Service: Filtered ActivityLog rows + total count
    Service-->>API: Data & Meta Envelope
    API-->>FE: JSON { data: ActivityLog[], meta: { page, limit, total, totalPages } }
    FE->>FE: Render TanStack Table with filtered results
    FE-->>User: Display Filtered Audit Trail
    end
```

---

## File Mapping

### Frontend Files (`apps/frontend/`)
| File | Purpose / Changes |
|---|---|
| `apps/frontend/src/routes/app/activity/+page.svelte` | Main Activity Log page component. Configures breadcrumbs, header, and filter toolbar (Search bar, Category buttons, Date Range inputs, Reset button). Handles reactive server-side search and URL param sync. |
| `apps/frontend/src/routes/app/activity/+page.ts` | Page load script setting `export const ssr = false;` for client-side API fetching with bearer auth tokens. |
| `apps/frontend/src/routes/app/activity/columns.ts` | TanStack ColumnDef definitions. Defines event dot color mappings (`bg-emerald-400`, `bg-[#DB8F5E]`, `bg-red-400`, `bg-amber-400`), User-Agent parser, relative timestamp calculator, and tooltip formatting helpers. |
| `apps/frontend/src/routes/app/activity/data-table.svelte` | Reactive TanStack Table component wrapping shadcn-svelte `Table.*` primitives (`Table.Root`, `Table.Header`, `Table.Row`, `Table.Cell`). Renders skeleton loaders, empty states, and pagination controls. |

### Backend Files (`apps/backend/`)
| File | Purpose / Changes |
|---|---|
| `apps/backend/src/shared/models/db.model.ts` | Updated `activityActionEnum` with `document.failed`, `document.quota_exhausted`, and `billing.payment_failed`. Added composite index `idx_activity_tenant_action_created` on `(tenantId, action, createdAt DESC)`. |
| `apps/backend/src/shared/utils/activity.util.ts` | Fixed `activityActionEnum` import from `import type` to value import. Exports `logActivity()` helper function. |
| `apps/backend/src/shared/utils/context.util.ts` | Provides `ContextExtractor.extractAuditContext()` to parse client IP headers (`x-forwarded-for`, `x-real-ip`, `cf-connecting-ip`), user agents, and request IDs from Hono context. |
| `apps/backend/src/modules/activities/activities.schema.ts` | Updated `GetActivitiesQuerySchema` with optional `category`, `startDate`, `endDate`, and `search` query parameters. |
| `apps/backend/src/modules/activities/activities.controller.ts` | Updated `handleGetActivities` to extract and pass query filters to `ActivitiesService.getActivities()`. |
| `apps/backend/src/modules/activities/activities.service.ts` | Updated `getActivities` to construct dynamic Drizzle SQL `WHERE` clauses (`and()`, `like()`, `gte()`, `lte()`, `sql`) for category, date range, and text search while respecting tenant isolation. |
| `apps/backend/src/modules/documents/documents.schema.ts` | Added optional `clientIp` and `userAgent` fields to `ConfirmUploadParamsSchema`, `DeleteDocumentParamsSchema`, and `BatchDeleteDocumentsParamsSchema`. |
| `apps/backend/src/modules/documents/documents.controller.ts` | Extracted audit context via `extractor.extractAuditContext()` in `handleConfirmUpload`, `handleDeleteDocument`, and `handleBatchDeleteDocuments`. |
| `apps/backend/src/modules/documents/documents.service.ts` | Passed `clientIp` and `userAgent` into `logActivity()` calls for `document.uploaded` and `document.deleted`. Added `logActivity` for `document.failed` inside `markDocumentFailed()`. Added `document.renamed` logging in `updateDocumentTitle` (PATCH /{id}). |
| `apps/backend/src/modules/auth/auth.schema.ts` | Added `clientIp` and `userAgent` to `UpdateTenantNameParamsSchema`. |
| `apps/backend/src/modules/auth/auth.controller.ts` | Extracted audit context in `handleUpdateTenantName`. |
| `apps/backend/src/modules/auth/auth.service.ts` | Passed `clientIp` and `userAgent` to `logActivity()` for `tenant.name_updated`. Updated `updateTenantName` signature to use `AuthParams.UpdateTenantNameParams`. |
| `apps/backend/src/modules/payments/payments.controller.ts` | Extracted audit context in `handleCheckout`, `handleWebhook`, and `handlePortal`. |
| `apps/backend/src/modules/payments/payments.service.ts` | Added `clientIp` and `userAgent` params to `handleWebhook`. Fixed payment status enum values (`SUCCEEDED`) and added webhook handlers for `checkout.session.async_payment_failed` and `invoice.payment_failed` to log `billing.payment_failed`. |
| `api-collections/Activities/1_Get Activities.bru` | Updated Bruno collection request for Activity Logs to include query params (`category`, `startDate`, `endDate`, `search`). |

---

## Connections

- **Database**: All queries against `activity_logs` in PostgreSQL are strictly filtered by `tenantId`. Composite indexes `(tenant_id, created_at DESC)` and `(tenant_id, action, created_at DESC)` guarantee low P95 query latencies for pagination, category filtering, and date range scans.
- **API Gateway**: Endpoint `GET /api/activities` is served by Hono and protected by `authMiddleware`.
- **Frontend Presentation**: SvelteKit fetches activity data via `apiRequest` from `$lib/api/client.ts` with query string parameters and renders clean UI elements formatted with Inter typography and theme design tokens.

---

## Architectural Decisions

1. **Option 1 Backend SQL Filtering & Composite Indexing**: Server-side pagination mandates that date range, category, and search filters execute in SQL. Client-side filtering on a paginated 10-15 row subset would produce broken pagination counts and incomplete search results.
2. **Composite Indexing**: Added `idx_activity_tenant_action_created` on `(tenantId, action, createdAt DESC)` to support prefix category filtering (`action LIKE 'auth.%'`) without triggering full table scans.
3. **Option 1 Frontend UI Presentation**: Parses raw User-Agent strings into recognizable browser/client names (`Firefox 152.0`, `Bruno 3.4.2`) and hides full timestamps / raw user-agents inside hover tooltips.
4. **Selective Business Failure Audit Logging**: Logged business-level outcome failures (`document.failed`, `document.quota_exhausted`, `billing.payment_failed`) in `activity_logs` while keeping generic 4xx/5xx errors out of PostgreSQL to prevent disk exhaustion.
