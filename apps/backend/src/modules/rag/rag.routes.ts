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

ragRoutes.openapi(
    createRoute({
        method: "patch",
        path: "/conversations/{id}",
        tags: ["RAG"],
        summary: "Update Conversation Title",
        description: "Updates the title of a conversation.",
        request: {
            params: RagSchema.ConversationParamSchema,
            body: {
                content: {
                    "application/json": {
                        schema: RagSchema.UpdateConversationBodySchema,
                    },
                },
                required: true,
            },
        },
        responses: {
            200: {
                description: "Success",
            },
            400: {
                description: "Validation error",
            },
            401: {
                description: "Unauthorized",
            },
            404: {
                description: "Not found",
            },
            500: {
                description: "Internal server error",
            },
        },
    }),
    ragController.handleUpdateConversationTitle as any,
);

ragRoutes.openapi(
    createRoute({
        method: "delete",
        path: "/conversations/{id}",
        tags: ["RAG"],
        summary: "Delete Conversation",
        description: "Deletes a conversation.",
        request: {
            params: RagSchema.ConversationParamSchema,
        },
        responses: {
            200: {
                description: "Success",
            },
            401: {
                description: "Unauthorized",
            },
            404: {
                description: "Not found",
            },
            500: {
                description: "Internal server error",
            },
        },
    }),
    ragController.handleDeleteConversation as any,
);

ragRoutes.openapi(
    createRoute({
        method: "get",
        path: "/conversations",
        tags: ["RAG"],
        summary: "List Conversations",
        description: "Returns a list of conversations for the current tenant, ordered by most recently updated.",
        responses: {
            200: {
                description: "Success",
                content: {
                    "application/json": {
                        schema: RagSchema.ListConversationsResponseSchema,
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
    ragController.handleListConversations as any,
);

ragRoutes.openapi(
    createRoute({
        method: "get",
        path: "/conversations/{id}",
        tags: ["RAG"],
        summary: "Get Conversation",
        description: "Returns a specific conversation and all of its chat turns.",
        request: {
            params: RagSchema.ConversationParamSchema,
        },
        responses: {
            200: {
                description: "Success",
                content: {
                    "application/json": {
                        schema: RagSchema.GetConversationResponseSchema,
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
                description: "Not found",
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
    ragController.handleGetConversation as any,
);
