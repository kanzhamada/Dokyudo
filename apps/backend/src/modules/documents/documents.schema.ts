import { z } from "@hono/zod-openapi";

export const PresignedUrlBodySchema = z.object({
    filename: z.string().min(1).openapi({
        example: "financial_report_2023.pdf",
    }),
    mimeType: z.string().min(1).openapi({
        example: "application/pdf",
    }),
    sizeBytes: z.number().int().positive().openapi({
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
