---
trigger: always_on
---

# Multi-Tenancy Data Isolation Policy

This rule enforces strict data isolation per tenant at the database level using Drizzle ORM. Data leakage across tenants is a critical security failure.

## Activation
- **Method**: Always On
- **Files**: `apps/backend/src/db/**/*.ts`, `apps/backend/src/services/**/*.ts`

---

## 1. The Tenant ID Mandate
Every database table (except global configuration tables) MUST have a `tenant_id` column. 

When generating Drizzle ORM queries (SELECT, UPDATE, DELETE), you are strictly forbidden from writing a query without a `.where()` clause that explicitly filters by `tenant_id`.

**❌ BAD (Data Leak):**
```typescript
await db.select().from(documents).where(eq(documents.id, docId));

```

**✅ GOOD (Isolated):**

```typescript
await db.select().from(documents).where(
  and(
    eq(documents.id, docId),
    eq(documents.tenant_id, tenantContext.tenantId)
  )
);

```

## 2. No Global State

Never cache tenant-specific data in global Node/Deno variables. Always pass the `tenant_id` explicitly down the function chain from the API Gateway's Hono Context (`c.get('tenantId')`).
