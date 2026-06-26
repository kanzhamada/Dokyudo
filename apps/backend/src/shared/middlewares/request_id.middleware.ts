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
    const requestId = c.req.header("x-request-id") ?? crypto.randomUUID();

    c.set("requestId", requestId);
    c.header("X-Request-ID", requestId);

    await next();
};
