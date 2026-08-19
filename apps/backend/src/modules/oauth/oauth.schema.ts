import { z } from "@hono/zod-openapi";

export const OAuthCallbackQuerySchema = z.object({
    code: z.string().optional().openapi({
        description: "Authorization code from provider",
    }),
    error: z.string().optional().openapi({
        description: "Error code if user denied consent",
    }),
    error_description: z.string().optional().openapi({
        description: "Human-readable error description",
    }),
}).openapi("OAuthCallbackQuery");

export type OAuthCallbackQuery = z.infer<typeof OAuthCallbackQuerySchema>;

export const OAuthCallbackParamsSchema = OAuthCallbackQuerySchema.extend({
    provider: z.enum(["google", "github"]),
    clientIp: z.string(),
    userAgent: z.string().optional(),
    requestId: z.string().optional(),
    logContext: z.any().optional(),
});

export type OAuthCallbackParams = z.infer<typeof OAuthCallbackParamsSchema>;

export const InitiateOAuthParamsSchema = z.object({
    provider: z.enum(["google", "github"]),
    logContext: z.any().optional(),
});

export type InitiateOAuthParams = z.infer<typeof InitiateOAuthParamsSchema>;
