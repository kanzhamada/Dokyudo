import { createRoute } from "@hono/zod-openapi";
import * as SearchSchema from "./search.schema.ts";
import * as searchController from "./search.controller.ts";
import { ErrorResponseSchema } from "../../shared/schemas/shared.schema.ts";
import { createApp } from "../../config/hono.ts";

export const searchRoutes = createApp();

searchRoutes.openapi(
    createRoute({
        method: "get",
        path: "/",
        tags: ["Search"],
        summary: "Hybrid Semantic Search",
        description:
            "Performs RRF hybrid search using Upstash Vector and Postgres FTS",
        request: {
            query: SearchSchema.SearchQuerySchema,
        },
        responses: {
            200: {
                description: "Search results",
                content: {
                    "application/json": {
                        schema: SearchSchema.SearchResponseSchema,
                    },
                },
            },
            400: {
                description: "Validation Error (invalid input)",
                content: {
                    "application/json": { schema: ErrorResponseSchema },
                },
            },
            401: {
                description: "Unauthorized",
                content: {
                    "application/json": { schema: ErrorResponseSchema },
                },
            },
            500: {
                description: "Internal server error",
                content: {
                    "application/json": { schema: ErrorResponseSchema },
                },
            },
        },
    }),
    searchController.handleSearch as any,
);
