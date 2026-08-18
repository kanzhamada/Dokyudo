import { Context, Next } from "hono";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "../../config/redis.ts";
import { extractClientIp } from "../utils/ip.util.ts";
import { AppError } from "../utils/errors.util.ts";

const standardLimiter = new Ratelimit({
    redis: redis as any,
    limiter: Ratelimit.slidingWindow(300, "1 m"),
    prefix: "rate_limit:std",
});

const strictLimiter = new Ratelimit({
    redis: redis as any,
    limiter: Ratelimit.slidingWindow(20, "1 m"),
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

    // Load-test bypass: honored only when the deployment explicitly sets
    // LOAD_TEST_BYPASS_TOKEN (e.g. a staging box or an authorized load-test
    // run). Off by default; the source contains no hardcoded secret.
    const loadTestToken = Deno.env.get("LOAD_TEST_BYPASS_TOKEN");
    if (loadTestToken && c.req.header("x-load-test-bypass") === loadTestToken) {
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
    } catch (err: any) {
        const logContext = c.get("logContext");
        if (logContext) logContext.redisError = err.message;
    }

    // Penalties (and the strict/block escalation they unlock) only apply to
    // auth-sensitive paths. An ordinary 4xx elsewhere — e.g. a 401 from an
    // expired session token on /api/me — must never downgrade the whole IP:
    // that used to snowball a routine SPA page load into a 1-hour block.
    const isAuthPath = /^\/api\/auth\//.test(c.req.path);

    let limiter = standardLimiter;
    if (isAuthPath) {
        if (penaltyScore >= 10) {
            limiter = blockLimiter;
        } else if (penaltyScore >= 5 || isSuspicious) {
            limiter = strictLimiter;
        }
    } else if (isSuspicious) {
        limiter = strictLimiter;
    }

    let success = true;
    let limitInfo = null;
    try {
        const result = await limiter.limit(ip);
        success = result.success;
        limitInfo = result;
    } catch (err: any) {
        const logContext = c.get("logContext");
        if (logContext) logContext.redisError = err.message;
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
            isAuthPath &&
            (status === 400 ||
                status === 401 ||
                status === 403 ||
                status === 429)
        ) {
            try {
                await redis.incr(penaltyKey);
                await redis.expire(penaltyKey, 3600);
            } catch (err: any) {
                const logContext = c.get("logContext");
                if (logContext) logContext.redisError = err.message;
            }
        }
        throw error;
    }

    // Process non-thrown errors (e.g. c.json({}, 400))
    const status = c.res.status;
    if (
        isAuthPath &&
        (status === 400 || status === 401 || status === 403 || status === 429)
    ) {
        try {
            await redis.incr(penaltyKey);
            await redis.expire(penaltyKey, 3600);
        } catch (err: any) {
            const logContext = c.get("logContext");
            if (logContext) logContext.redisError = err.message;
        }
    }
}
