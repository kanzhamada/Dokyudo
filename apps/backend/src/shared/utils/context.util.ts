import { Context } from "hono";
import { AppError } from "./errors.util.ts";
import { extractClientIp } from "./ip.util.ts";

export class ContextExtractor {
    private c: Context;

    constructor(c: Context) {
        this.c = c;
    }

    extractBaseContext() {
        return {
            logContext: this.c.get("logContext"),
        };
    }

    extractAuthContext() {
        const tenantId = this.c.get("tenantId");
        const userId = this.c.get("userId");

        if (!tenantId || !userId) {
            throw new AppError({
                code: "UNAUTHORIZED",
                message: "Missing tenant or user context",
                status: 401,
            });
        }

        return {
            ...this.extractBaseContext(),
            tenantId,
            userId,
        };
    }

    extractAuditContext() {
        const requestId = this.c.get("requestId") ?? crypto.randomUUID();
        const clientIp = extractClientIp(this.c.req.raw.headers);
        const userAgent = this.c.req.header("user-agent") ?? "unknown";

        return {
            ...this.extractBaseContext(),
            requestId,
            clientIp,
            userAgent,
        };
    }

    extractBearerToken() {
        const authHeader = this.c.req.header("Authorization");
        
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            throw new AppError({
                code: "UNAUTHORIZED",
                message: "Missing or invalid authorization token",
                status: 401,
            });
        }
        
        return authHeader.split(" ")[1];
    }

    /**
     * Extracts validated JSON body from Hono Context, casted to the expected type.
     */
    extractValidJson<T = any>(): T {
        return this.c.req.valid("json" as never) as T;
    }
}
