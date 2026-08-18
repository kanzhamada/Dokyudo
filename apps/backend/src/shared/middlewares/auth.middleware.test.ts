import { assertEquals } from "@std/assert";
import { describe, it, afterAll } from "jsr:@std/testing/bdd";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { authMiddleware } from "./auth.middleware.ts";
import { AppError } from "../utils/errors.util.ts";
import { db } from "../../config/drizzle.ts";
import { tenants, users } from "../models/db.model.ts";
import { eq } from "drizzle-orm";

const app = new Hono();

app.onError((err: any, c: any) => {
  if (err instanceof AppError) {
    return c.json(err.toJSON("test-req-id"), err.status as any);
  }
  return c.json({ error: "INTERNAL_ERROR" }, 500);
});

app.use("/protected/*", authMiddleware);

app.get("/protected/data", (c: any) => {
  return c.json({
    userId: c.get("userId"),
    tenantId: c.get("tenantId"),
  });
});

const MOCK_SECRET = "super-secret-jwt-key-for-testing-only-123456";

describe("AuthMiddleware", () => {
  it("Missing Authorization header", async () => {
    Deno.env.set("SUPABASE_JWT_SECRET", MOCK_SECRET);
    const res = await app.request("/protected/data");
    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.error.code, "UNAUTHORIZED");
  });

  it("Invalid JWT signature", async () => {
    Deno.env.set("SUPABASE_JWT_SECRET", MOCK_SECRET);

    const token = await sign(
      { sub: "user-123", exp: Math.floor(Date.now() / 1000) + 60 * 5 },
      "wrong-secret",
      "HS256",
    );

    const res = await app.request("/protected/data", {
      headers: { Authorization: `Bearer ${token}` },
    });

    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.error.code, "UNAUTHORIZED");
  });

  it("Valid token with tenant_id in claims", async () => {
    Deno.env.set("SUPABASE_JWT_SECRET", MOCK_SECRET);

    const token = await sign(
      {
        sub: "user-123",
        app_metadata: { tenant_id: "tenant-456" },
        exp: Math.floor(Date.now() / 1000) + 60 * 5,
      },
      MOCK_SECRET,
      "HS256",
    );

    const res = await app.request("/protected/data", {
      headers: { Authorization: `Bearer ${token}` },
    });

    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.userId, "user-123");
    assertEquals(body.tenantId, "tenant-456");
  });
});

describe("AuthMiddleware (deleted account)", () => {
  const deletedTenantId = crypto.randomUUID();
  const deletedUserId = crypto.randomUUID();
  const deletedEmail = `deleted-mw-${crypto.randomUUID()}@example.com`;

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, deletedUserId));
    await db.delete(tenants).where(eq(tenants.id, deletedTenantId));
  });

  it("rejects a token whose user is deleted even with a valid signature", async () => {
    Deno.env.set("SUPABASE_JWT_SECRET", MOCK_SECRET);

    // Seed a soft-deleted user+tenant in the real DB.
    await db.insert(tenants).values({
      id: deletedTenantId,
      name: "Deleted Tenant",
      deletionStatus: "deleted",
      deletedAt: new Date(),
    });
    await db.insert(users).values({
      id: deletedUserId,
      tenantId: deletedTenantId,
      email: deletedEmail,
      deletionStatus: "deleted",
      deletedAt: new Date(),
    });

    // No tenant_id in claims — resolution must hit the DB and find no ACTIVE
    // row for this user.
    const token = await sign(
      {
        sub: deletedUserId,
        exp: Math.floor(Date.now() / 1000) + 60 * 5,
      },
      MOCK_SECRET,
      "HS256",
    );

    const res = await app.request("/protected/data", {
      headers: { Authorization: `Bearer ${token}` },
    });

    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.error.code, "UNAUTHORIZED");
  });

  it("rejects a deletion_pending user (mid-purge)", async () => {
    Deno.env.set("SUPABASE_JWT_SECRET", MOCK_SECRET);

    const pendingTenantId = crypto.randomUUID();
    const pendingUserId = crypto.randomUUID();
    const pendingEmail = `pending-mw-${crypto.randomUUID()}@example.com`;

    await db.insert(tenants).values({
      id: pendingTenantId,
      name: "Pending Tenant",
      deletionStatus: "deletion_pending",
    });
    await db.insert(users).values({
      id: pendingUserId,
      tenantId: pendingTenantId,
      email: pendingEmail,
      deletionStatus: "deletion_pending",
    });

    try {
      const token = await sign(
        {
          sub: pendingUserId,
          exp: Math.floor(Date.now() / 1000) + 60 * 5,
        },
        MOCK_SECRET,
        "HS256",
      );

      const res = await app.request("/protected/data", {
        headers: { Authorization: `Bearer ${token}` },
      });

      assertEquals(res.status, 401);
    } finally {
      await db.delete(users).where(eq(users.id, pendingUserId));
      await db.delete(tenants).where(eq(tenants.id, pendingTenantId));
    }
  });
});
