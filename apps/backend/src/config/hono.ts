import { OpenAPIHono } from "@hono/zod-openapi";
import { AppEnv } from "../shared/types/app.types.ts";

export function createApp(): OpenAPIHono<AppEnv> {
    return new OpenAPIHono<AppEnv>({
        defaultHook: (result, c) => {
            if (!result.success) {
                const requestId = c.get("requestId") ?? crypto.randomUUID();
                const firstIssue = (result as any).error.issues[0];
                const message = firstIssue
                    ? `${firstIssue.path.join(".")}: ${firstIssue.message}`
                    : "Validation failed";

                return c.json(
                    {
                        error: {
                            code: "VALIDATION_ERROR" as const,
                            message,
                            requestId,
                        },
                    },
                    400
                );
            }
        },
    });
}