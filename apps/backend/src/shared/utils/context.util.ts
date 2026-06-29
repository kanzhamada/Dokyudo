import { Context } from "hono";
import { AppError } from "./errors.util.ts";

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
}
