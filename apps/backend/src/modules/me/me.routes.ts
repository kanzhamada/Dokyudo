import { createApp } from "../../config/hono.ts";
import { createRoute } from "@hono/zod-openapi";
import * as meController from "./me.controller.ts";
import * as MeSchema from "./me.schema.ts";
import { ErrorResponseSchema } from "../../shared/schemas/shared.schema.ts";

export const meRoutes = createApp();

meRoutes.openapi(
    createRoute({
        method: "get",
        path: "/",
        tags: ["Me"],
        summary: "Get current user profile and subscription tier",
        description:
            "Returns user details, tenant info, and current subscription status. Automatically handles lazy-downgrade if subscription is expired.",
        responses: {
            200: {
                description: "Profile returned successfully",
                content: {
                    "application/json": {
                        schema: MeSchema.ProfileResponseSchema,
                    },
                },
            },
            401: {
                description: "Unauthorized",
                content: {
                    "application/json": {
                        schema: ErrorResponseSchema,
                    },
                },
            },
            500: {
                description: "Internal server error",
                content: {
                    "application/json": {
                        schema: ErrorResponseSchema,
                    },
                },
            },
        },
    }),
    meController.handleGetProfile as any,
);

meRoutes.openapi(
    createRoute({
        method: "get",
        path: "/usage",
        tags: ["Me"],
        summary: "Get realtime tenant usage statistics",
        description:
            "Returns uploads count, searches count, QA count, and storage used bytes for the authenticated tenant.",
        responses: {
            200: {
                description: "Usage statistics returned successfully",
                content: {
                    "application/json": {
                        schema: MeSchema.UsageResponseSchema,
                    },
                },
            },
            401: {
                description: "Unauthorized",
                content: {
                    "application/json": {
                        schema: ErrorResponseSchema,
                    },
                },
            },
            404: {
                description: "Subscription not found",
                content: {
                    "application/json": {
                        schema: ErrorResponseSchema,
                    },
                },
            },
            500: {
                description: "Internal server error",
                content: {
                    "application/json": {
                        schema: ErrorResponseSchema,
                    },
                },
            },
        },
    }),
    meController.handleGetUsage as any,
);
