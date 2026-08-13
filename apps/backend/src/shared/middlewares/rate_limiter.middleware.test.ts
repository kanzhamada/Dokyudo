import { assert, assertEquals } from "@std/assert";
import { describe, it, beforeAll, afterAll, beforeEach } from "jsr:@std/testing/bdd";
import { Hono } from "hono";
import { rateLimiterMiddleware } from "./rate_limiter.middleware.ts";
import { AppError } from "../utils/errors.util.ts";
import { redis } from "../../config/redis.ts";

const originalEnv = Deno.env.get("NODE_ENV");

const app = new Hono();

app.onError((err: any, c: any) => {
    if (err instanceof AppError) {
        return c.json(err.toJSON("test-req-id"), err.status as any);
    }
    return c.json({ error: "INTERNAL_ERROR" }, 500);
});

app.use("/*", rateLimiterMiddleware);

app.get("/ok", (c: any) => c.text("OK"));
app.get("/api/rag/shares/abc123", (c: any) => c.json({ code: "abc123" }));
app.get("/error-401", (c: any) => {
    throw new AppError({
        code: "UNAUTHORIZED",
        message: "Bad pass",
        status: 401,
    });
});

describe("RateLimiter Middleware", () => {
    beforeAll(() => {
        // The middleware skips its checks outside prod — enforce prod semantics.
        Deno.env.set("NODE_ENV", "prod");
    });

    afterAll(() => {
        if (originalEnv) Deno.env.set("NODE_ENV", originalEnv);
        else Deno.env.delete("NODE_ENV");
    });

    beforeEach(async () => {
        // Clear potential penalties for IP addresses used in the tests
        await redis.del("penalty:1.1.1.1");
        await redis.del("penalty:2.2.2.2");
        await redis.del("penalty:3.3.3.3");
    });

    it("Allows normal requests", async () => {
        const res = await app.request("/ok", {
            headers: {
                "X-Forwarded-For": "1.1.1.1",
                "User-Agent": "Mozilla/5.0",
            },
        });

        assertEquals(res.status, 200);
        assertEquals(await res.text(), "OK");
        assert(
            res.headers.has("x-ratelimit-remaining"),
            "Should have remaining limit header",
        );
    });

    it("Suspicious User-Agents get strict limit", async () => {
        const res = await app.request("/ok", {
            headers: {
                "X-Forwarded-For": "2.2.2.2",
                "User-Agent": "python-requests/2.25.1 bot",
            },
        });

        assertEquals(res.status, 200);
        const remaining = parseInt(
            res.headers.get("x-ratelimit-remaining") || "0",
            10,
        );
        assert(
            remaining < 10 && remaining >= 0,
            "Strict limit should be applied",
        );
    });

    it("Public share reads are exempt from rate limiting", async () => {
        // Hammer a share read from one IP with a suspicious UA — no 429, no
        // rate-limit headers, because public share reads skip the limiter.
        for (let i = 0; i < 15; i++) {
            const res = await app.request("/api/rag/shares/abc123", {
                headers: {
                    "X-Forwarded-For": "9.9.9.9",
                    "User-Agent": "curl/8.0",
                },
            });
            assertEquals(res.status, 200);
        }
        const json = await (await app.request("/api/rag/shares/abc123", {
            headers: { "X-Forwarded-For": "9.9.9.9", "User-Agent": "curl/8.0" },
        })).json();
        assertEquals(json.code, "abc123");
    });

    it("Penalizes IP on 401 errors", async () => {
        // 1st request, throws 401
        const res1 = await app.request("/error-401", {
            headers: {
                "X-Forwarded-For": "3.3.3.3",
                "User-Agent": "Mozilla/5.0",
            },
        });
        assertEquals(res1.status, 401);

        const penalty = await redis.get("penalty:3.3.3.3");
        assertEquals(Number(penalty), 1);

        for (let i = 0; i < 4; i++) {
            await app.request("/error-401", {
                headers: {
                    "X-Forwarded-For": "3.3.3.3",
                    "User-Agent": "Mozilla/5.0",
                },
            });
        }

        const newPenalty = await redis.get("penalty:3.3.3.3");
        assertEquals(Number(newPenalty), 5);

        // Consume the strict limit
        for (let i = 0; i < 11; i++) {
            const blockRes = await app.request("/ok", {
                headers: {
                    "X-Forwarded-For": "3.3.3.3",
                    "User-Agent": "Mozilla/5.0",
                },
            });
            if (blockRes.status === 429) {
                assert(true);
                return;
            }
        }
        assert(false, "Should have been rate limited by strictLimiter");
    });
});
