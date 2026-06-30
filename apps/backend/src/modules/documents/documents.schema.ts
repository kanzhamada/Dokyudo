import { z } from "@hono/zod-openapi";
import { MAX_DOCUMENT_SIZE_BYTES } from "../../shared/constants/documents.constant.ts";

const SUPPORTED_MIME_TYPES = ["application/pdf", "text/plain"] as const;

export const PresignedUrlBodySchema = z.object({
    filename: z.string().min(1).refine((name) => {
        const ext = name.split('.').pop()?.toLowerCase();
        return ext === "pdf" || ext === "txt";
    }, { message: "Unsupported file extension. Only .pdf and .txt files are allowed." }).openapi({
        example: "financial_report_2023.pdf",
    }),
    mimeType: z.enum(SUPPORTED_MIME_TYPES, {
        errorMap: () => ({ message: "Unsupported MIME type. Only application/pdf and text/plain are allowed." })
    }).openapi({
        example: "application/pdf",
    }),
    sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_SIZE_BYTES, `File size exceeds the maximum limit of ${MAX_DOCUMENT_SIZE_BYTES} bytes.`).openapi({
        example: 1048576,
        description: "File size in bytes",
    }),
});

export type PresignedUrlBody = z.infer<typeof PresignedUrlBodySchema>;

export const CreatePresignedUrlParamsSchema = PresignedUrlBodySchema.extend({
    tenantId: z.string(),
    logContext: z.any().optional(),
});

export type CreatePresignedUrlParams = z.infer<typeof CreatePresignedUrlParamsSchema>;

export const PresignedUrlResponseSchema = z.object({
    url: z.string().openapi({
        example: "https://s3.dokyudo.my.id/dokyudo-documents/...",
        description: "The presigned PUT URL for upload",
    }),
    documentId: z.string().uuid().openapi({
        example: "123e4567-e89b-12d3-a456-426614174000",
        description: "The ID of the newly created pending document",
    }),
    key: z.string().openapi({
        example: "tenant-id/doc-uuid.pdf",
        description: "The storage object key",
    }),
    expiresIn: z.number().openapi({
        example: 900,
        description: "URL expiration time in seconds",
    }),
});

export type PresignedUrlResponse = z.infer<typeof PresignedUrlResponseSchema>;

export const ConfirmUploadBodySchema = z.object({
    documentId: z.string().uuid().openapi({
        example: "123e4567-e89b-12d3-a456-426614174000",
        description: "The ID of the document to confirm",
    }),
});

export type ConfirmUploadBody = z.infer<typeof ConfirmUploadBodySchema>;

export const ConfirmUploadParamsSchema = ConfirmUploadBodySchema.extend({
    tenantId: z.string(),
    logContext: z.any().optional(),
});

export type ConfirmUploadParams = z.infer<typeof ConfirmUploadParamsSchema>;

export const ConfirmUploadResponseSchema = z.object({
    message: z.string().openapi({
        example: "Document uploaded and confirmed successfully",
    }),
    documentId: z.string().uuid().openapi({
        example: "123e4567-e89b-12d3-a456-426614174000",
    }),
    status: z.string().openapi({
        example: "confirmed",
    }),
});

export type ConfirmUploadResponse = z.infer<typeof ConfirmUploadResponseSchema>;

export const DeleteDocumentParamSchema = z.object({
    id: z.string().uuid().openapi({
        example: "123e4567-e89b-12d3-a456-426614174000",
        description: "The ID of the document to delete",
    }),
});

export const DeleteDocumentParamsSchema = z.object({
    documentId: z.string().uuid(),
    tenantId: z.string(),
    logContext: z.any().optional(),
});

export type DeleteDocumentParams = z.infer<typeof DeleteDocumentParamsSchema>;

export const DeleteDocumentResponseSchema = z.object({
    success: z.boolean().openapi({ example: true }),
    message: z.string().openapi({ example: "Document successfully deleted" }),
});

export type DeleteDocumentResponse = z.infer<typeof DeleteDocumentResponseSchema>;

export const ListDocumentsParamsSchema = z.object({
    tenantId: z.string(),
    logContext: z.any().optional(),
});

export type ListDocumentsParams = z.infer<typeof ListDocumentsParamsSchema>;

export const DocumentItemSchema = z.object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable(),
    storagePath: z.string(),
    sizeBytes: z.number(),
    status: z.string(),
    createdAt: z.string(),
});

export type DocumentItem = z.infer<typeof DocumentItemSchema>;

export const ListDocumentsResponseSchema = z.object({
    documents: z.array(DocumentItemSchema),
});

export type ListDocumentsResponse = z.infer<typeof ListDocumentsResponseSchema>;

export const GetDocumentPreviewParamSchema = z.object({
    id: z.string().uuid().openapi({
        example: "123e4567-e89b-12d3-a456-426614174000",
        description: "The ID of the document to preview",
    }),
});

export const GetDocumentPreviewParamsSchema = z.object({
    documentId: z.string().uuid(),
    tenantId: z.string(),
    logContext: z.any().optional(),
});

export type GetDocumentPreviewParams = z.infer<typeof GetDocumentPreviewParamsSchema>;

export const GetDocumentPreviewResponseSchema = z.object({
    url: z.string().url().openapi({
        example: "https://s3.dokyudo.my.id/dokyudo-documents/...",
        description: "The presigned GET URL for viewing the document",
    }),
    expiresIn: z.number().openapi({
        example: 43200,
        description: "URL expiration time in seconds",
    }),
});

export type GetDocumentPreviewResponse = z.infer<typeof GetDocumentPreviewResponseSchema>;
