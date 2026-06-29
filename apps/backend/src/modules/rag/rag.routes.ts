import { createApp } from "../../config/hono.ts";
import { createRoute } from "@hono/zod-openapi";
import * as ragController from "./rag.controller.ts";
import { ErrorResponseSchema } from "../../shared/schemas/shared.schema.ts";
import * as RagSchema from "./rag.schema.ts";

export const ragRoutes = createApp();

ragRoutes.openapi(
    createRoute({
        method: "post",
        path: "/chat",
        tags: ["RAG"],
        summary: "SSE Streaming RAG Chat",
        description:
            "Accepts a question and returns an SSE stream of tokens from the LLM.",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: RagSchema.ChatBodySchema,
                    },
                },
                required: true,
            },
        },
        responses: {
            200: {
                description: "SSE Stream of tokens",
                // Zod-OpenAPI doesn't have a strict definition for text/event-stream,
                // so we just define the expected content type.
            },
            400: {
                description: "Validation error",
                content: {
                    "application/json": {
                        schema: ErrorResponseSchema,
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
    ragController.handleChat as any,
);
