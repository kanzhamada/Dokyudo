# Document Upload & Management

## Core Logic
This feature encompasses the entire lifecycle of a knowledge document within the RAG pipeline. It facilitates direct client-to-storage file uploads to bypass server memory limits, guarantees database consistency upon upload confirmation, provides safe, cascading deletion to purge data across the relational database, object storage, and vector index, tracks storage consumption per tenant, and handles document previews and direct browser downloads.

Key capabilities:
- **Two-Phase Staged Batch Upload**: Files added via drag-and-drop or browse are queued locally in browser memory (`staged`) without sending network requests until the user clicks "Upload Documents".
- **Presigned URLs**: Grants secure, temporary (15-min) PUT access for the client to upload files directly to MinIO (S3-compatible storage), registering the file as `pending` in the DB.
- **Upload Confirmation & Storage Accounting**: Transitions a `pending` document to `confirmed` after verifying the object physically exists in S3, atomically updating `tenant_subscriptions.storage_used_bytes` and `uploads_count`.
- **List Documents**: A `GET` endpoint that retrieves all documents belonging to a tenant, designed specifically to supply the SvelteKit frontend load function for client-side table rendering (TanStack Table).
- **Document Preview & Download**: A `GET` endpoint (`/api/documents/:id/preview`) that securely generates a short-lived Presigned GET URL (12 hours). Passing `download=true` sets `Content-Disposition: attachment; filename="..."` so the browser directly prompts the user for a download location rather than rendering inline in a new tab.
- **Comprehensive & Batch Deletion**: Single `DELETE /api/documents/:id` and batch `POST /api/documents/batch-delete` endpoints that purge documents, cancel STB Worker jobs, remove vector embeddings from Upstash Vector, delete binary files in MinIO, and refund tenant storage quota in Postgres.

## Flow Diagram

```mermaid
sequenceDiagram
    actor Client
    participant API Gateway (Deno)
    participant Database (Postgres)
    participant VectorDB (Upstash)
    participant Storage (MinIO)

    %% Staged Batch Upload Flow
    Client->>Client: Drag / Select Files (Local Staging)
    Note over Client: User clicks "Upload Documents"
    Client->>API Gateway: POST /api/documents/presigned-url/batch
    API Gateway->>Storage: generatePresignedPutUrl()
    API Gateway->>Database: INSERT INTO documents (status: 'pending')
    API Gateway-->>Client: Returns presigned URLs + docIds

    loop For each file
        Client->>Storage: PUT File to Presigned URL (XHR % Progress)
        Storage-->>Client: 200 OK
        Client->>API Gateway: POST /api/documents/confirm-upload
        API Gateway->>Storage: HeadObject (verify existence)
        API Gateway->>Database: UPDATE documents SET status = 'confirmed'
        API Gateway->>Database: UPDATE tenant_subscriptions SET storage_used_bytes += sizeBytes
        API Gateway-->>Client: 200 OK
    end

    %% Batch / Single Deletion Flow
    Client->>API Gateway: DELETE /api/documents/:id (or /batch-delete)
    API Gateway->>Database: SELECT chunks (get vector IDs)
    API Gateway->>VectorDB: DELETE vectors by chunk IDs
    API Gateway->>Storage: DeleteObject
    API Gateway->>Database: DELETE FROM documents (cascades to chunks)
    API Gateway->>Database: UPDATE tenant_subscriptions SET storage_used_bytes -= totalBytes
    API Gateway-->>Client: 200 OK
    
    %% Listing Flow
    Client->>API Gateway: GET /api/documents
    API Gateway->>Database: SELECT * FROM documents WHERE tenant_id = ...
    API Gateway-->>Client: 200 OK (JSON array)

    %% Preview & Download Flow
    Client->>API Gateway: GET /api/documents/:id/preview?download=true
    API Gateway->>Database: SELECT storagePath, title
    API Gateway->>Storage (AWS SDK): generatePresignedGetUrl(ResponseContentDisposition)
    API Gateway-->>Client: 200 OK (url, expiresIn)
    Client->>Storage: Direct Stream / Save Location Prompt
```

## Completion Timestamp
**Date:** 2026-07-24
**Time:** 17:40 (UTC+7)

## File Mapping
- `apps/backend/src/shared/utils/tier_quota.util.ts`: Formatted MB display with `.toFixed(2)` and updated storage quota check to read `tenant_subscriptions.storage_used_bytes` directly.
- `apps/backend/src/modules/documents/documents.service.ts`: Implemented `createPresignedUrlBatch`, `confirmUpload`, `deleteDocument`, `batchDeleteDocuments`, `listDocuments`, and `getDocumentPreview` with atomic quota updates.
- `apps/backend/src/modules/documents/documents.controller.ts`: Added request handlers bridging Zod validation and query parameter extraction to the service layer.
- `apps/backend/src/modules/documents/documents.routes.ts`: OpenAPI schemas for all Document CRUD operations, preview, download, and batch endpoints.
- `apps/backend/src/modules/documents/documents.schema.ts`: Standardized Zod I/O, query validation, and presigned url batch schemas.
- `apps/backend/src/shared/utils/s3.util.ts`: Extended `generatePresignedGetUrl` with `ResponseContentDisposition` support.
- `apps/frontend/src/routes/app/documents/+page.ts`: Client-side loader fetching tenant documents via `apiRequest`.
- `apps/frontend/src/routes/app/documents/+page.svelte`: Main document library page with search filtering, delete confirmation dialog, and live auto-refresh.
- `apps/frontend/src/routes/app/documents/UploadDocumentDialog.svelte`: Two-phase staged batch upload modal with real-time XHR progress and red "Cancel All" danger button.
- `apps/frontend/src/routes/app/documents/document-card-actions.svelte`: Dropdown menu for document preview, download, and deletion.
- `api-collections/Documents/06_Get Document Preview.bru`: Updated Bruno API collection with `download` query param.

## Connections
- **Client (Frontend):** Manages local staging, streams uploads to MinIO with real-time percentage feedback, previews PDFs inline using `@embedpdf/svelte-pdf-viewer`, and triggers direct attachment downloads via Sonner toast feedback.
- **Deno API (Backend):** Manages authorization, orchestration, OpenAPI contracts, S3 URL signing, and atomic quota management in PostgreSQL.
- **PostgreSQL (Database):** Stores metadata and enforces `tenant_subscriptions.storage_used_bytes` quota tracking alongside `ON DELETE CASCADE` chunk cleanup.
- **Upstash Vector:** Purges vectors via the Upstash SDK `vectorIndex.delete()`.
- **MinIO (S3):** Stores raw files securely with private access.

## Architectural Decisions
1. **Direct-to-S3 Uploads**: Prevents the Deno Edge Worker from hitting memory or timeout constraints when processing large PDF files by eliminating the need to buffer uploads in RAM.
2. **Order of Deletion Operations**: The backend extracts `chunkIds` *before* hitting Postgres, deletes from Vector, then S3, then finally Postgres. This ensures that if the process dies halfway, we don't have orphaned data in external stores without a DB record to track them.
3. **Tenant-Level Isolation**: All document database queries (`SELECT`, `UPDATE`, `DELETE`) enforce an explicit `and(eq(documents.tenantId, params.tenantId))` constraint, strictly preventing IDOR vulnerabilities.
4. **Client-Side Data Processing**: For listing documents, the backend sends the entire tenant's document list in one JSON response. The SvelteKit frontend utilizes TanStack Table to handle sorting, filtering, and pagination exclusively on the client side, ensuring rapid UI responsiveness without needing multiple backend endpoints for small-to-medium scale document libraries.
5. **Secure Previews**: The MinIO bucket is kept strictly private. Previews are generated dynamically via `getDocumentPreview` using AWS SDK's `GetObjectCommand`, yielding a 12-hour Presigned GET URL. This prevents hotlinking and data leakage while still allowing rich client-side rendering.
6. **Direct Attachment Presigned URLs for Downloads**: Passing `ResponseContentDisposition` during S3 presigned GET URL creation instructs the browser to stream the file straight to disk and prompt for a save location, bypassing JS memory buffers and eliminating the need for a separate server download endpoint.
7. **Two-Phase Staged Batch Upload**: Decouples file selection from network execution. Files sit in browser memory (`staged`) until the user explicitly clicks "Upload Documents", preventing accidental API calls and orphaned S3 objects.
8. **Storage Quota Accounting at `confirm-upload` and `delete`**: Updating `tenant_subscriptions.storage_used_bytes` during `confirm-upload` ensures storage is charged only for files physically present in S3. Deleting documents automatically decrements `storage_used_bytes` to refund tenant capacity.
9. **Destructive Action Safeguards**: Provides a confirmation modal with an animated spinner for single document deletions and a red glass "Cancel All" button during batch uploads to prevent accidental data loss and allow users to purge in-flight upload batches.
