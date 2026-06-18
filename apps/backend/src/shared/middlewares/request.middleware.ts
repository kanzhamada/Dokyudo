import type { MiddlewareHandler } from "hono";

/**
 * Middleware that ensures every request has a unique request ID.
 *
 * - Reads from `X-Request-ID` header if present (reverse proxy scenario)
 * - Falls back to a new crypto.randomUUID()
 * - Stores in context as `requestId`
 * - Sets the response header `X-Request-ID` for traceability
 */
export const requestIdMiddleware: MiddlewareHandler = async (c, next) => {
    const requestId =
        c.req.header("x-request-id") ?? crypto.randomUUID();

    c.set("requestId", requestId);
    c.header("X-Request-ID", requestId);

    await next();
};

/**
 * Extracts the client IP address from the request, handling reverse proxy headers.
 *
 * Priority order:
 *   1. X-Forwarded-For (first IP in chain)
 *   2. X-Real-IP
 *   3. CF-Connecting-IP (Cloudflare)
 *   4. Fallback: "0.0.0.0"
 */
export function extractClientIp(headers: Headers): string {
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded) {
        // X-Forwarded-For may contain multiple IPs: client, proxy1, proxy2
        const firstIp = forwarded.split(",")[0]?.trim();
        if (firstIp) return firstIp;
    }

    const realIp = headers.get("x-real-ip");
    if (realIp) return realIp.trim();

    const cfIp = headers.get("cf-connecting-ip");
    if (cfIp) return cfIp.trim();

    return "0.0.0.0";
}
