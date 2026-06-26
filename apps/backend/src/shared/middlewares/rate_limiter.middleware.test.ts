import { assert, assertEquals } from "@std/assert";
import { Hono } from "hono";
import { rateLimiterMiddleware } from "./rate_limiter.middleware.ts";
import { AppError } from "../utils/errors.util.ts";
import { redis } from "../../config/redis.ts";

const app = new Hono();

// Glassertobal Error Handler for tests to match main.ts
app.onError((err: any, c: any) => {
    if (err instanceof AppError) {
        return c.json(err.toJSON("test-req-id"), err.status as any);
    }
    return c.json({ error: "INTERNAL_ERROR" }, 500);
});

app.use("/*", rateLimiterMiddleware);

app.get("/ok", (c: any) => c.text("OK"));
app.get("/error-401", (c: any) => {
    throw new AppError({
        code: "UNAUTHORIZED",
        message: "Bad pass",
        status: 401,
    });
});

Deno.test({
    name: "RateLimiter: Allows normal requests",
    async fn() {
        // Clear penalty
        await redis.del("penalty:1.1.1.1");

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
    },
});

Deno.test({
    name: "RateLimiter: Suspicious User-Agents get strict limit",
    async fn() {
        await redis.del("penalty:2.2.2.2");

        const res = await app.request("/ok", {
            headers: {
                "X-Forwarded-For": "2.2.2.2",
                "User-Agent": "python-requests/2.25.1 bot",
            },
        });

        assertEquals(res.status, 200);
        // The remaining limit should be out of 10, so it will be 9 (or close to it)
        const remaining = parseInt(
            res.headers.get("x-ratelimit-remaining") || "0",
            10,
        );
        assert(
            remaining < 10 && remaining >= 0,
            "Strict limit should be applied",
        );
    },
});

Deno.test({
    name: "RateLimiter: Penalizes IP on 401 errors",
    async fn() {
        await redis.del("penalty:3.3.3.3");

        // 1st request, throws 401
        const res1 = await app.request("/error-401", {
            headers: {
                "X-Forwarded-For": "3.3.3.3",
                "User-Agent": "Mozilla/5.0",
            },
        });
        assertEquals(res1.status, 401);

        // Penalty should now be 1
        const penalty = await redis.get("penalty:3.3.3.3");
        assertEquals(Number(penalty), 1);

        // Throw 4 more 401s to reach penalty = 5
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

        // Now it should be on strictLimiter (10 req/min limit)
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
    },
});
