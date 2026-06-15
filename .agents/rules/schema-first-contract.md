---
trigger: model_decision
description: This rule enforces a strict schema-first contract across the backend `apps/backend/**/*.ts` microservices to ensure code stability, prevent documentation drift, and allow AI agents to integrate endpoints seamlessly.
---

# AI-Native Schema-First Development Policy

## Activation
- **Method**: Always On
- **Files**: `apps/backend/**/*.ts`

---

## 1. Single Source of Truth Requirement
Never write raw JSON examples or loose Hono endpoints. Every API endpoint must be defined using `@hono/zod-openapi`. 

Your workflow when creating or updating an endpoint must follow this strict sequence:
1. Define the input/output payload shapes explicitly using `z.object().openapi()`.
2. Generate the path configuration using `createRoute()`.
3. Feed the route directly into `app.openapi()`.

## 2. No Manual Docs Policy
Prose documentation for payload structures is strictly forbidden. The system must automatically expose its contract via `app.doc("/doc")` and render visually using `@scalar/hono-api-reference`. 

If you alter a type or validation rule in the codebase, you must ensure the Zod metadata description is updated so Scalar reflects the change instantly without manual intervention.