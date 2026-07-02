import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { KeysController } from "./keys.controller.ts";
import {
    UpsertKeyBodySchema,
    ProviderParamSchema,
    KeyResponseSchema,
} from "./keys.schema.ts";
import { ErrorResponseSchema } from "../../shared/schemas/shared.schema.ts";

export const keysRoutes = new OpenAPIHono();

keysRoutes.openapi(
    createRoute({
        method: "post",
        path: "/",
        summary: "Upsert API Key",
        request: {
            body: {
                content: {
                    "application/json": { schema: UpsertKeyBodySchema },
                },
            },
        },
        responses: {
            200: { description: "Success" },
            400: {
                description: "Validation error",
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
    KeysController.upsertKey as any,
);

keysRoutes.openapi(
    createRoute({
        method: "get",
        path: "/",
        summary: "List API Keys",
        responses: {
            200: {
                description: "Success",
                content: {
                    "application/json": {
                        schema: z.object({ data: z.array(KeyResponseSchema) }),
                    },
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
    KeysController.getKeys as any,
);

keysRoutes.openapi(
    createRoute({
        method: "delete",
        path: "/{provider}",
        summary: "Delete API Key",
        request: {
            params: ProviderParamSchema,
        },
        responses: {
            200: { description: "Success" },
            400: {
                description: "Validation error",
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
            404: {
                description: "Not found",
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
    KeysController.deleteKey as any,
);
