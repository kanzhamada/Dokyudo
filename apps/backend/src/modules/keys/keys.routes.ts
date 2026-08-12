import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { KeysController } from "./keys.controller.ts";
import {
    UpsertKeyBodySchema,
    TestKeyBodySchema,
    ProviderParamSchema,
    KeyResponseSchema,
} from "./keys.schema.ts";
import { ErrorResponseSchema } from "../../shared/schemas/shared.schema.ts";

export const keysRoutes = new OpenAPIHono();

keysRoutes.openapi(
    createRoute({
        method: "put",
        path: "/",
        summary: "Upsert API Key",
        description: "Creates a new API key (201) or updates an existing one (200) for the given provider.",
        request: {
            body: {
                content: {
                    "application/json": { schema: UpsertKeyBodySchema },
                },
            },
        },
        responses: {
            201: { description: "Key created" },
            200: { description: "Key updated" },
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

keysRoutes.openapi(
    createRoute({
        method: "post",
        path: "/test",
        summary: "Test API Key",
        description: "Validates the API key by making a minimal test call to the provider.",
        request: {
            body: {
                content: {
                    "application/json": { schema: TestKeyBodySchema },
                },
            },
        },
        responses: {
            200: {
                description: "Test result",
                content: {
                    "application/json": {
                        schema: z.object({
                            data: z.object({
                                valid: z.boolean(),
                                message: z.string(),
                            }),
                        }),
                    },
                },
            },
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
    KeysController.testKey as any,
);
