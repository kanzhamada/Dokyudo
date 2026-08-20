import { describe, it, beforeAll, afterAll, beforeEach } from "jsr:@std/testing/bdd";
import { assertEquals } from "jsr:@std/assert";
import { Hono } from "hono";
import { cryptoPuzzleMiddleware } from "./crypto_puzzle.middleware.ts";
import { redis } from "../../config/redis.ts";
import { AppError } from "../utils/errors.util.ts";

describe("CryptoPuzzle Middleware", () => {
    let app: Hono;
    const originalEnv = Deno.env.get("NODE_ENV");

    // A valid BROWSER token for testing
    // Must match: K:2, I:2, N:1, S:1, Y:2, J:1, H:1, O:1, 2:1, 1:2, 3:1 + A:1, N:3, T:1, O:1, I:1
    const validBrowserToken = "KKIIINNNNSYYJHOO2113ATXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

    beforeAll(() => {
        // Enforce puzzle verification: the middleware skips its checks in
        // dev/test environments, so run with production semantics.
        Deno.env.set("NODE_ENV", "production");

        app = new Hono();
        
        // Simple error handler for AppError catching
        app.onError((err, c) => {
            if (err instanceof AppError) {
                return c.json({ error: err.message }, err.status as any);
            }
            return c.json({ error: "Internal" }, 500);
        });

        app.use("*", cryptoPuzzleMiddleware);
        
        app.get("/protected", (c) => c.json({ success: true }));
        app.get("/api/auth/login", (c) => c.json({ success: true }));
        app.get("/api/oauth/google", (c) => c.json({ success: true }));
        app.get("/api/oauth/github", (c) => c.json({ success: true }));
        app.get("/api/oauth/google/callback", (c) => c.json({ success: true }));
        app.post("/api/payments/webhook", (c) => c.json({ success: true }));
        app.get("/api/rag/shares/abc123", (c) => c.json({ code: "abc123" }));
        app.get("/api/rag/shares/abc123/continue", (c) => c.json({ success: true }));
    });

    afterAll(() => {
        if (originalEnv) Deno.env.set("NODE_ENV", originalEnv);
        else Deno.env.delete("NODE_ENV");
    });

    beforeEach(async () => {
        // Clear redis keys related to our tokens to ensure a clean slate
        await redis.del(`puzzle:${validBrowserToken}`);
    });

    it("negative: rejects request missing puzzle header", async () => {
        const req = new Request("http://localhost/protected");
        const res = await app.fetch(req);
        
        assertEquals(res.status, 403);
        const json = await res.json();
        assertEquals(json.error, "Missing X-Dokyudo-Puzzle Proof of Work Header");
    });

    it("negative: rejects request with invalid puzzle signature", async () => {
        const req = new Request("http://localhost/protected", {
            headers: { "X-Dokyudo-Puzzle": "invalid_token_format_short" }
        });
        const res = await app.fetch(req);
        
        assertEquals(res.status, 403);
        const json = await res.json();
        assertEquals(json.error, "Invalid Crypto Puzzle Token Signature");
    });

    it("positive: allows request with valid new puzzle token", async () => {
        const req = new Request("http://localhost/protected", {
            headers: { 
                "X-Dokyudo-Puzzle": validBrowserToken,
                "User-Agent": "Mozilla/5.0"
            }
        });
        const res = await app.fetch(req);
        
        assertEquals(res.status, 200);
        const json = await res.json();
        assertEquals(json.success, true);
    });

    it("negative: blocks replay attack on reused puzzle token", async () => {
        // First request is allowed and token is cached
        const req1 = new Request("http://localhost/protected", {
            headers: { 
                "X-Dokyudo-Puzzle": validBrowserToken,
                "User-Agent": "Mozilla/5.0"
            }
        });
        await app.fetch(req1);

        // Second request uses the same token, should be blocked
        const req2 = new Request("http://localhost/protected", {
            headers: { 
                "X-Dokyudo-Puzzle": validBrowserToken,
                "User-Agent": "Mozilla/5.0"
            }
        });
        const res2 = await app.fetch(req2);
        
        assertEquals(res2.status, 403);
        const json = await res2.json();
        assertEquals(json.error.includes("Replay Attack Detected"), true);
    });

    it("positive: allows public share read without puzzle header", async () => {
        const req = new Request("http://localhost/api/rag/shares/abc123");
        const res = await app.fetch(req);
        
        assertEquals(res.status, 200);
        const json = await res.json();
        assertEquals(json.code, "abc123");
    });

    it("positive: allows oauth routes without puzzle header (browser redirect flow)", async () => {
        const googleReq = new Request("http://localhost/api/oauth/google");
        const googleRes = await app.fetch(googleReq);
        assertEquals(googleRes.status, 200);

        const githubReq = new Request("http://localhost/api/oauth/github");
        const githubRes = await app.fetch(githubReq);
        assertEquals(githubRes.status, 200);

        const callbackReq = new Request("http://localhost/api/oauth/google/callback");
        const callbackRes = await app.fetch(callbackReq);
        assertEquals(callbackRes.status, 200);
    });

    it("positive: allows auth routes and webhooks without puzzle header", async () => {
        const authReq = new Request("http://localhost/api/auth/login");
        const authRes = await app.fetch(authReq);
        assertEquals(authRes.status, 200);

        const webhookReq = new Request("http://localhost/api/payments/webhook", {
            method: "POST",
        });
        const webhookRes = await app.fetch(webhookReq);
        assertEquals(webhookRes.status, 200);
    });

    it("negative: still requires puzzle for share mutations and invite reads", async () => {
        const continueReq = new Request("http://localhost/api/rag/shares/abc123/continue", {
            method: "POST"
        });
        const continueRes = await app.fetch(continueReq);
        assertEquals(continueRes.status, 403);
    });
});
