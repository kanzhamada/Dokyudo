---
trigger: model_decision
description: This rule guarantees that our API documentation and request collection files (`collections/`) remain perfectly in sync with the Deno + Hono backend implementation.
---

# Backend Endpoint and API Collection Synchronization

## Activation
- **Method**: Model Decision
- **Files**: `apps/backend/**/*.ts`, `collections/**/*.yml`

---

## 1. Synchronization Requirement

Whenever you add, modify, or delete an HTTP endpoint in the Deno backend (`apps/backend/`), you are **strictly forbidden** from performing parallel modifications inside the `collections/` directory automatically.

Instead, at the end of your task, you **must prompt the user** with a numbered checklist of post-task actions:
1. Sync API Collection
2. Write Backend Tests
3. Update Second Brain Docs

Wait for the user to input the corresponding number (e.g., "1, 2") before executing the synchronization. Do not execute this rule without explicit permission.

## 2. Directory Mapping Rules

Locate the correct domain-specific subdirectory within `collections/` based on the endpoint route prefix:

| Backend Route Prefix | Collection Directory |
| :--- | :--- |
| `/api/auth/*` | `collections/Auth/` |
| `/api/documents/*` | `collections/Documents/` |
| `/api/search/*` or `/api/chat/*` | `collections/Search & RAG/` |
| `/api/activities/*`, `/api/webhooks/*`, `/api/quotas/*` | `collections/Webhooks & Quotas/` |
| `/internal/*` or `/admin/*` | `collections/Admin & Internal/` |
| `/health` | `collections/System/` |

## 3. Formatting Conventions

1. **Filename Prefixing**: Follow the sequential numerical numbering system already established in the workspace (e.g., `01_Name.yml`, `02_Name.yml`). If adding a new endpoint, find the highest index in that folder and increment it by 1.
2. **YAML Format**: Ensure the YAML format adheres to the workspace's open collection configuration standards.
3. **Main Registry**: If a new folder is introduced or top-level structure changes, update the primary configuration file at `collections/opencollection.yml`.

## 4. Execution Workflow Example

If instructed to: *"Add a balance check endpoint under quotas"*
1. Modify `apps/backend/main.ts` to implement the endpoint.
2. Scan `collections/Webhooks & Quotas/` to check the current highest index (e.g., `05_Get Activity Feed.yml`).
3. Create a new file named `collections/Webhooks & Quotas/06_Get Balance Status.yml` containing the matching endpoint definition, methods, headers, and request body payload schemas.