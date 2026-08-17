import { assertEquals } from "@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { authMiddleware } from "./auth.middleware.ts";
import { AppError } from "../utils/errors.util.ts";
import {
  ACCESS_TOKEN_COOKIE,
  clearSessionCookies,
  setSessionCookies,
} from "../../config/cookie.ts";

const app = new Hono();

app.onError((err: any, c: any) => {
  if (err instanceof AppError) {
    return c.json(err.toJSON("test-req-id"), err.status as any);
  }
  return c.json({ error: "INTERNAL_ERROR" }, 500);
});

app.use("/protected/*", authMiddleware);
app.get("/protected/data", (c: any) => {
  return c.json({ userId: c.get("userId"), tenantId: c.get("tenantId") });
});

// Endpoint that sets cookies (mirrors the login controller).
app.get("/login-cookie", (c: any) => {
  setSessionCookies(c, "access-token-abc", "refresh-token-xyz");
  return c.json({ ok: true });
});

// Endpoint that clears cookies (mirrors the logout controller).
app.get("/logout-cookie", (c: any) => {
  clearSessionCookies(c);
  return c.json({ ok: true });
});

const MOCK_SECRET = "super-secret-jwt-key-for-testing-only-123456";

describe("Cookie-based auth flow", () => {
  it("setSessionCookies emits two httpOnly cookies", async () => {
    const res = await app.request("/login-cookie");
    const setCookie = res.headers.getSetCookie();
    assertEquals(setCookie.length, 2);

    const access = setCookie.find((c) => c.includes("dokyudo_access_token="));
    const refresh = setCookie.find((c) => c.includes("dokyudo_refresh_token="));
    assertEquals(access?.includes("HttpOnly"), true);
    assertEquals(refresh?.includes("HttpOnly"), true);
    assertEquals(access?.includes("Max-Age=3600"), true);
    assertEquals(refresh?.includes("Max-Age=2592000"), true);
  });

  it("clearSessionCookies expires both cookies", async () => {
    const res = await app.request("/logout-cookie");
    const setCookie = res.headers.getSetCookie();
    assertEquals(setCookie.length, 2);
    for (const c of setCookie) {
      assertEquals(c.includes("Max-Age=0"), true);
    }
  });

  it("authMiddleware accepts a valid token from the cookie", async () => {
    Deno.env.set("SUPABASE_JWT_SECRET", MOCK_SECRET);

    const token = await sign(
      {
        sub: "user-cookie-1",
        app_metadata: { tenant_id: "tenant-cookie-1" },
        exp: Math.floor(Date.now() / 1000) + 60 * 5,
      },
      MOCK_SECRET,
      "HS256",
    );

    const res = await app.request("/protected/data", {
      headers: { Cookie: `${ACCESS_TOKEN_COOKIE}=${token}` },
    });

    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.userId, "user-cookie-1");
    assertEquals(body.tenantId, "tenant-cookie-1");
  });

  it("authMiddleware rejects when no cookie and no bearer", async () => {
    const res = await app.request("/protected/data");
    assertEquals(res.status, 401);
  });
});
