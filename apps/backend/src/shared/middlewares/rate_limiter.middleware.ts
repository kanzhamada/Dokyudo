import { Context, Next } from "hono";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "../../config/redis.ts";
import { extractClientIp } from "../utils/ip.util.ts";
import { AppError } from "../utils/errors.util.ts";

const standardLimiter = new Ratelimit({
    redis: redis as any,
    limiter: Ratelimit.slidingWindow(100, "1 m"),
    prefix: "rate_limit:std",
});

const strictLimiter = new Ratelimit({
    redis: redis as any,
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    prefix: "rate_limit:strict",
});

const blockLimiter = new Ratelimit({
    redis: redis as any,
    limiter: Ratelimit.slidingWindow(1, "1 h"),
    prefix: "rate_limit:block",
});

export async function rateLimiterMiddleware(c: Context, next: Next) {
    if (Deno.env.get("NODE_ENV") !== "prod") {
        return next();
    }

    if (c.req.path.includes("/webhook")) {
        return next();
    }

    // Public share reads are exempt from rate limiting: share pages are public
    // URLs opened by social crawlers and rendered server-side by the frontend
    // worker, whose shared egress IP would otherwise accumulate penalties and
    // get blocked (breaking every share page + OpenGraph image for all users).
    const isPublicShareRead =
        c.req.method === "GET" &&
        /^\/api\/rag\/shares\/[^/]+$/.test(c.req.path);
    if (isPublicShareRead) {
        return next();
    }

    // Load Test Bypass
    if (c.req.header("x-load-test-bypass") === "rahasia123") {
        return next();
    }

    const ip = extractClientIp(c.req.raw.headers);
    const userAgent = c.req.header("user-agent")?.toLowerCase() || "";

    // Anomaly Detection: Suspicious User-Agents
    const isSuspicious =
        !userAgent ||
        userAgent.includes("curl") ||
        userAgent.includes("python") ||
        userAgent.includes("bot") ||
        userAgent.includes("crawl") ||
        userAgent.includes("spider") ||
        userAgent.includes("headless");

    const penaltyKey = `penalty:${ip}`;
    let penaltyScore = 0;
    try {
        penaltyScore = Number(await redis.get(penaltyKey)) || 0;
    } catch (err) {
        console.error("Redis penalty check failed:", err);
    }

    let limiter = standardLimiter;
    if (penaltyScore >= 10) {
        limiter = blockLimiter;
    } else if (penaltyScore >= 5 || isSuspicious) {
        limiter = strictLimiter;
    }

    let success = true;
    let limitInfo = null;
    try {
        const result = await limiter.limit(ip);
        success = result.success;
        limitInfo = result;
    } catch (err) {
        console.error("Redis rate limit failed:", err);
    }

    if (limitInfo) {
        c.header("X-RateLimit-Limit", limitInfo.limit.toString());
        c.header("X-RateLimit-Remaining", limitInfo.remaining.toString());
        c.header("X-RateLimit-Reset", limitInfo.reset.toString());
    }

    if (!success) {
        throw new AppError({
            code: "RATE_LIMIT_EXCEEDED",
            message:
                "Too many requests from this IP address. Please try again later.",
            status: 429,
        });
    }

    try {
        await next();
    } catch (error) {
        let status = 500;
        if (error instanceof AppError) {
            status = error.status;
        }

        if (
            status === 400 ||
            status === 401 ||
            status === 403 ||
            status === 429
        ) {
            try {
                await redis.incr(penaltyKey);
                await redis.expire(penaltyKey, 3600);
            } catch (err) {
                console.error("Redis penalty incr failed:", err);
            }
        }
        throw error;
    }

    // Process non-thrown errors (e.g. c.json({}, 400))
    const status = c.res.status;
    if (status === 400 || status === 401 || status === 403 || status === 429) {
        try {
            await redis.incr(penaltyKey);
            await redis.expire(penaltyKey, 3600);
        } catch (err) {
            console.error("Redis penalty incr failed:", err);
        }
    }
}
