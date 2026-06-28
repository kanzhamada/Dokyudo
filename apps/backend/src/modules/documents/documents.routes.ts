import { createApp } from "../../config/hono.ts";
import { createRoute } from "@hono/zod-openapi";
import * as documentsController from "./documents.controller.ts";
import { ErrorResponseSchema } from "../../shared/schemas/shared.schema.ts";
import * as DocumentsSchema from "./documents.schema.ts";

export const documentsRoutes = createApp();

documentsRoutes.openapi(
    createRoute({
        method: "post",
        path: "/presigned-url",
        tags: ["Documents"],
        summary: "Generate a MinIO Presigned URL for upload",
        description:
            "Returns a secure presigned PUT URL valid for 15 minutes. " +
            "Creates a pending document record in the database. " +
            "The client should use this URL to directly upload the file to storage.",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: DocumentsSchema.PresignedUrlBodySchema,
                    },
                },
                required: true,
            },
        },
        responses: {
            201: {
                description: "Presigned URL generated successfully",
                content: {
                    "application/json": {
                        schema: DocumentsSchema.PresignedUrlResponseSchema,
                    },
                },
            },
            400: {
                description: "Validation error (e.g., file too large)",
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
    documentsController.handleGeneratePresignedUrl as any,
);

documentsRoutes.openapi(
    createRoute({
        method: "post",
        path: "/confirm-upload",
        tags: ["Documents"],
        summary: "Confirm document upload",
        description:
            "Verifies that a document was successfully uploaded to the storage service " +
            "and updates its status in the database to 'confirmed'.",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: DocumentsSchema.ConfirmUploadBodySchema,
                    },
                },
                required: true,
            },
        },
        responses: {
            200: {
                description: "Upload confirmed successfully",
                content: {
                    "application/json": {
                        schema: DocumentsSchema.ConfirmUploadResponseSchema,
                    },
                },
            },
            400: {
                description: "Validation error or file not found in storage",
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
            404: {
                description: "Document not found in database",
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
    documentsController.handleConfirmUpload as any,
);
