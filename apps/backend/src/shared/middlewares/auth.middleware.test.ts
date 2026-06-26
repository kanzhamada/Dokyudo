import { assert, assertEquals, assertRejects } from "@std/assert";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { authMiddleware } from "./auth.middleware.ts";
import { AppError } from "../utils/errors.util.ts";

const app = new Hono();

// Global Error Handler for tests
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

Deno.test({
  name: "AuthMiddleware: Missing Authorization header",
  async fn() {
    Deno.env.set("SUPABASE_JWT_SECRET", MOCK_SECRET);
    const res = await app.request("/protected/data");
    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.error.code, "UNAUTHORIZED");
  },
});

Deno.test({
  name: "AuthMiddleware: Invalid JWT signature",
  async fn() {
    Deno.env.set("SUPABASE_JWT_SECRET", MOCK_SECRET);
    
    // Sign with WRONG secret
    const token = await sign(
      { sub: "user-123", exp: Math.floor(Date.now() / 1000) + 60 * 5 },
      "wrong-secret",
      "HS256"
    );

    const res = await app.request("/protected/data", {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.error.message, "Invalid JWT signature");
  },
});

Deno.test({
  name: "AuthMiddleware: Valid token with tenant_id in claims",
  async fn() {
    Deno.env.set("SUPABASE_JWT_SECRET", MOCK_SECRET);
    
    const token = await sign(
      { 
        sub: "user-123", 
        app_metadata: { tenant_id: "tenant-456" },
        exp: Math.floor(Date.now() / 1000) + 60 * 5 
      },
      MOCK_SECRET,
      "HS256"
    );

    const res = await app.request("/protected/data", {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.userId, "user-123");
    assertEquals(body.tenantId, "tenant-456");
  },
});
