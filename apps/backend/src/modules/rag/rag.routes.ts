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
        method: "post",
        path: "/conversations/{id}/branch",
        tags: ["RAG"],
        summary: "Branch Conversation",
        description:
            "Creates a new conversation that copies the history up to (and including) the given turn, marked as a branch of the source conversation.",
        request: {
            params: RagSchema.ConversationParamSchema,
            body: {
                content: {
                    "application/json": {
                        schema: RagSchema.BranchConversationBodySchema,
                    },
                },
                required: true,
            },
        },
        responses: {
            200: {
                description: "Success — returns the new conversation id",
            },
            400: {
                description: "Validation error",
            },
            401: {
                description: "Unauthorized",
            },
            404: {
                description: "Conversation or turn not found",
            },
            500: {
                description: "Internal server error",
            },
        },
    }),
    ragController.handleBranchConversation as any,
);

ragRoutes.openapi(
    createRoute({
        method: "patch",
        path: "/conversations/{id}",
        tags: ["RAG"],
        summary: "Update Conversation",
        description: "Updates the title and/or pinned status of a conversation.",
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
    ragController.handleUpdateConversation as any,
);

ragRoutes.openapi(
    createRoute({
        method: "patch",
        path: "/conversations/{id}/turns/{turnId}/feedback",
        tags: ["RAG"],
        summary: "Update Turn Feedback",
        description:
            "Sets or clears (rating=null) the user's good/bad feedback on a single turn.",
        request: {
            params: RagSchema.TurnFeedbackParamSchema,
            body: {
                content: {
                    "application/json": {
                        schema: RagSchema.TurnFeedbackBodySchema,
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
    ragController.handleUpdateTurnFeedback as any,
);

ragRoutes.openapi(
    createRoute({
        method: "delete",
        path: "/conversations/{id}/turns/{turnId}",
        tags: ["RAG"],
        summary: "Delete Turn",
        description: "Deletes a single turn from a conversation.",
        request: {
            params: RagSchema.TurnFeedbackParamSchema,
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
    ragController.handleDeleteTurn as any,
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
        description: "Returns a list of conversations for the current tenant, ordered by most recently updated. Supports cursor-based pagination.",
        request: {
            query: RagSchema.ListConversationsQuerySchema,
        },
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
