import { createRoute } from "@hono/zod-openapi";
import { createApp } from "../../config/hono.ts";
import { ActivitiesController } from "./activities.controller.ts";
import { GetActivitiesQuerySchema, GetActivitiesResponseSchema } from "./activities.schema.ts";
import { ErrorResponseSchema } from "../../shared/schemas/shared.schema.ts";

export const activitiesRoutes = createApp();

activitiesRoutes.openapi(
    createRoute({
        method: "get",
        path: "/",
        tags: ["Activities"],
        summary: "Get Activity Logs",
        description: "Fetch paginated activity logs for the current tenant",
        request: {
            query: GetActivitiesQuerySchema,
        },
        responses: {
            200: {
                description: "Success",
                content: {
                    "application/json": {
                        schema: GetActivitiesResponseSchema,
                    },
                },
            },
            401: {
                description: "Unauthorized",
                content: { "application/json": { schema: ErrorResponseSchema } },
            },
            500: {
                description: "Internal Error",
                content: { "application/json": { schema: ErrorResponseSchema } },
            },
        },
    }),
    ActivitiesController.handleGetActivities as any,
);
