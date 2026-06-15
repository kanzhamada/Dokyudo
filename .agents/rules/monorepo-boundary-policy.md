---
trigger: always_on
---

# Monorepo Architectural Boundary Enforcement

This rule protects the separation of concerns between the SvelteKit Client layer and the Deno API Backend.

## Activation
- **Method**: Always On
- **Files**: `apps/frontend/**/*.svelte`, `apps/frontend/**/*.ts`

---

## 1. Strict Isolation
The frontend (`apps/frontend`) is a presentation layer only. It MUST NOT communicate with the PostgreSQL database directly.

**Forbidden Actions in `apps/frontend`:**
- Do not import `drizzle-orm` or any database schema files.
- Do not use `$env/dynamic/private` to read `DATABASE_URL`.
- Do not write SQL queries inside `+page.server.ts` or `hooks.server.ts`.

## 2. Communication Protocol
The frontend must exclusively fetch data by making HTTP requests (e.g., via standard `fetch`) to the API Gateway (`apps/backend` running on its respective port) and consume the strictly typed `@hono/zod-openapi` JSON responses.
