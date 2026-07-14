import { createApp } from "../../config/hono.ts";
import { createRoute } from "@hono/zod-openapi";
import * as documentsController from "./documents.controller.ts";
import { ErrorResponseSchema } from "../../shared/schemas/shared.schema.ts";
import * as DocumentsSchema from "./documents.schema.ts";

export const documentsRoutes = createApp();

documentsRoutes.openapi(
    createRoute({
        method: "post",
        path: "/presigned-url/batch",
        tags: ["Documents"],
        summary: "Generate MinIO Presigned URLs for batch upload",
        description:
            "Returns secure presigned PUT URLs valid for 15 minutes for an array of files. " +
            "Creates pending document records in the database. " +
            "The client should use these URLs to directly upload the files to storage.",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: DocumentsSchema.PresignedUrlBatchBodySchema,
                    },
                },
                required: true,
            },
        },
        responses: {
            201: {
                description: "Presigned URLs generated successfully",
                content: {
                    "application/json": {
                        schema: DocumentsSchema.PresignedUrlBatchResponseSchema,
                    },
                },
            },
            400: {
                description: "Validation error (e.g., file too large, batch size exceeded)",
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
    documentsController.handleGeneratePresignedUrlBatch as any,
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

documentsRoutes.openapi(
    createRoute({
        method: "post",
        path: "/batch-delete",
        tags: ["Documents"],
        summary: "Cancel or Delete a batch of documents",
        description:
            "Deletes multiple documents from the database, removes their vector embeddings from Upstash, " +
            "and deletes their files from S3 storage. Also refunds the upload quota.",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: DocumentsSchema.BatchDeleteDocumentsBodySchema,
                    },
                },
                required: true,
            },
        },
        responses: {
            200: {
                description: "Documents deleted successfully",
                content: {
                    "application/json": {
                        schema: DocumentsSchema.BatchDeleteDocumentsResponseSchema,
                    },
                },
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
    documentsController.handleBatchDeleteDocuments as any,
);
