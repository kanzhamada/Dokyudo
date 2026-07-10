import type { MiddlewareHandler } from "hono";
import { AppError } from "../utils/errors.util.ts";
import { extractClientIp } from "../utils/ip.util.ts";

/**
 * Middleware that accumulates context for a Wide Event log.
 * Emits a single JSON log line at the end of the request.
 */
export const loggerMiddleware: MiddlewareHandler = async (c, next) => {
    const start = performance.now();
    const requestId = c.get("requestId") ?? crypto.randomUUID();

    const logContext: Record<string, any> = {
        event: "http_request",
        requestId,
        method: c.req.method,
        path: c.req.path,
        ip: extractClientIp(c.req.raw.headers),
    };

    c.set("logContext", logContext);

    await next();
    
    if (c.error) {
        logContext.error = c.error.message;
        if (!(c.error instanceof AppError)) {
            logContext.stack = c.error.stack;
        }
    }

    logContext.status = c.res.status;
    logContext.durationMs = Math.round(performance.now() - start);

    const isDev = Deno.env.get("NODE_ENV") !== "prod";
    if (isDev) {
        console.log(JSON.stringify(logContext, null, 2));
    } else {
        console.log(JSON.stringify(logContext));
    }
};
