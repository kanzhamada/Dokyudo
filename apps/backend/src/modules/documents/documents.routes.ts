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

documentsRoutes.openapi(
    createRoute({
        method: "delete",
        path: "/{id}",
        tags: ["Documents"],
        summary: "Delete a document",
        description:
            "Deletes a document from the database, removes its vector embeddings from Upstash, " +
            "and deletes the associated file from S3 storage.",
        request: {
            params: DocumentsSchema.DeleteDocumentParamSchema,
        },
        responses: {
            200: {
                description: "Document deleted successfully",
                content: {
                    "application/json": {
                        schema: DocumentsSchema.DeleteDocumentResponseSchema,
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
                description: "Document not found",
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
    documentsController.handleDeleteDocument as any,
);

documentsRoutes.openapi(
    createRoute({
        method: "get",
        path: "/",
        tags: ["Documents"],
        summary: "List all documents",
        description: "Returns a list of all documents for the authenticated tenant.",
        responses: {
            200: {
                description: "List of documents",
                content: {
                    "application/json": {
                        schema: DocumentsSchema.ListDocumentsResponseSchema,
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
    documentsController.handleListDocuments as any,
);

documentsRoutes.openapi(
    createRoute({
        method: "get",
        path: "/{id}/preview",
        tags: ["Documents"],
        summary: "Get a presigned GET URL for a document",
        description: "Generates a presigned GET URL (12 hours) that can be used directly in an iframe, PDF viewer, or downloaded.",
        request: {
            params: DocumentsSchema.GetDocumentPreviewParamSchema,
        },
        responses: {
            200: {
                description: "Presigned URL generated successfully",
                content: {
                    "application/json": {
                        schema: DocumentsSchema.GetDocumentPreviewResponseSchema,
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
                description: "Document not found",
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
    documentsController.handleGetDocumentPreview as any,
);
