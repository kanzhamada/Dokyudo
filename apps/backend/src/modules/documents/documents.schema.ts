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
