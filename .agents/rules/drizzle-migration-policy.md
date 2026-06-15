---
trigger: model_decision
description: Enforces safe, additive-only database migration practices using Drizzle ORM to prevent data loss and schema drift.
---

# Drizzle Migration Policy

## Activation
- **Method**: Model Decision
- **Files**: `packages/db/**/*.ts`, `packages/db/migrations/**/*.sql`

---

## 1. Migration Workflow

1. Modify schema in `packages/db/schema/`.
2. Run `deno task generate` to produce migration SQL.
3. Review generated SQL for destructive operations.
4. Commit migration to `packages/db/migrations/`.
5. Apply with `deno task migrate`.

**Never** write raw `ALTER TABLE` SQL directly. **Never** modify a migration file after it has been applied.

---

## 2. Additive-Only Constraint

| Operation | Rule |
|---|---|
| `DROP TABLE` | ❌ Forbidden. Archive data first, drop in maintenance window. |
| `DROP COLUMN` | ❌ Forbidden as single step. Use 3-step deprecation: stop writing → verify no reads → drop in next sprint. |
| `ALTER ... SET NOT NULL` | ⚠️ Only if all rows satisfy constraint. Add `DEFAULT` first if needed. |
| `RENAME COLUMN` | ⚠️ Prefer add new → migrate data → deprecate old. |

---

## 3. Phase Transitions

Phase 1→2 example: Add `embedding vector(1536)` column. Existing rows keep `NULL` until re-processed. Never drop Phase 1 columns.

---

## 4. Index Management

Create indexes in migrations, not inline code. Use `CONCURRENTLY` on large tables in production.

---

## 5. Seed Data

Seeds live in `packages/db/seed/`, **never** in migration files. Apply via `deno task seed`. Seeds must be idempotent (upserts).
