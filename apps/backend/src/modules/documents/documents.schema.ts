import { z } from "@hono/zod-openapi";
import { MAX_DOCUMENT_SIZE_BYTES } from "../../shared/constants/documents.constant.ts";

export const FileRequestSchema = z.object({
    filename: z.string().min(1).refine((name) => {
        const ext = name.split('.').pop()?.toLowerCase();
        return ext === "pdf" || ext === "txt" || ext === "docx";
    }, { message: "Unsupported file extension. Only .pdf, .txt and .docx files are allowed." }).openapi({
        example: "financial_report_2023.pdf",
    }),
    mimeType: z.enum([
        "application/pdf",
        "text/plain",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ] as const, {
        message: "Unsupported MIME type. Only application/pdf, text/plain and Word documents are allowed."
    }).openapi({
        example: "application/pdf",
    }),
    sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_SIZE_BYTES, `File size exceeds the maximum limit of ${MAX_DOCUMENT_SIZE_BYTES} bytes.`).openapi({
        example: 1048576,
        description: "File size in bytes",
    }),
});

export const PresignedUrlBatchBodySchema = z.object({
    files: z.array(FileRequestSchema).min(1).max(10, "Maximum of 10 files allowed per batch").openapi({
        description: "Array of files to upload",
    })
});

export type PresignedUrlBatchBody = z.infer<typeof PresignedUrlBatchBodySchema>;

export const CreatePresignedUrlBatchParamsSchema = PresignedUrlBatchBodySchema.extend({
    tenantId: z.string(),
    logContext: z.any().optional(),
});

export type CreatePresignedUrlBatchParams = z.infer<typeof CreatePresignedUrlBatchParamsSchema>;

export const PresignedUrlResponseItemSchema = z.object({
    filename: z.string(),
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

export type PresignedUrlResponseItem = z.infer<typeof PresignedUrlResponseItemSchema>;

export const PresignedUrlBatchResponseSchema = z.object({
    results: z.array(PresignedUrlResponseItemSchema)
});

export type PresignedUrlBatchResponse = z.infer<typeof PresignedUrlBatchResponseSchema>;

export const ConfirmUploadBodySchema = z.object({
    documentId: z.string().uuid().openapi({
        example: "123e4567-e89b-12d3-a456-426614174000",
        description: "The ID of the document to confirm",
    }),
});

export type ConfirmUploadBody = z.infer<typeof ConfirmUploadBodySchema>;

export const ConfirmUploadParamsSchema = ConfirmUploadBodySchema.extend({
    tenantId: z.string(),
    clientIp: z.string().optional(),
    userAgent: z.string().optional(),
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
    clientIp: z.string().optional(),
    userAgent: z.string().optional(),
    logContext: z.any().optional(),
});

export type DeleteDocumentParams = z.infer<typeof DeleteDocumentParamsSchema>;

export const DeleteDocumentResponseSchema = z.object({
    success: z.boolean().openapi({ example: true }),
    message: z.string().openapi({ example: "Document successfully deleted" }),
});

export type DeleteDocumentResponse = z.infer<typeof DeleteDocumentResponseSchema>;

export const BatchDeleteDocumentsBodySchema = z.object({
    documentIds: z.array(z.string().uuid()).max(50).openapi({
        example: ["123e4567-e89b-12d3-a456-426614174000", "123e4567-e89b-12d3-a456-426614174001"],
        description: "Array of document IDs to delete/cancel",
    }),
});

export const BatchDeleteDocumentsParamsSchema = z.object({
    documentIds: z.array(z.string().uuid()),
    tenantId: z.string(),
    clientIp: z.string().optional(),
    userAgent: z.string().optional(),
    logContext: z.any().optional(),
});

export type BatchDeleteDocumentsParams = z.infer<typeof BatchDeleteDocumentsParamsSchema>;

export const BatchDeleteDocumentsResponseSchema = z.object({
    success: z.boolean().openapi({ example: true }),
    deletedCount: z.number().openapi({ example: 2 }),
    message: z.string().openapi({ example: "Documents successfully deleted" }),
});

export type BatchDeleteDocumentsResponse = z.infer<typeof BatchDeleteDocumentsResponseSchema>;


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

export const GetDocumentPreviewQuerySchema = z.object({
    download: z.enum(["true", "false"]).optional().openapi({
        description: "If 'true', sets Content-Disposition attachment header to prompt file download.",
    }),
});

export const GetDocumentPreviewParamsSchema = z.object({
    documentId: z.string().uuid(),
    tenantId: z.string(),
    download: z.boolean().optional(),
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

// ─────────────────────────────────────────────────────────────────────────────
// Rename document
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maximum length of a document title (including the file extension).
 */
export const DOCUMENT_TITLE_MAX_LENGTH = 255;

/**
 * Whitelist of allowed characters in a document title.
 *
 * Only Unicode letters, digits, ASCII spaces, and a small set of safe
 * punctuation are accepted. Everything that can carry or escape markup or
 * SQL — angle brackets, quotes, backticks, semicolons, equals signs, slashes,
 * percent, and other metacharacters — is rejected outright, so a title can
 * never smuggle an XSS payload or a SQL fragment into storage or rendered
 * output.
 */
export const DOCUMENT_TITLE_REGEX = /^[\p{L}\p{N} .\-_,&+@#:!?()]+$/u;

export const DocumentTitleSchema = z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .max(DOCUMENT_TITLE_MAX_LENGTH, `Title must be at most ${DOCUMENT_TITLE_MAX_LENGTH} characters`)
    .regex(DOCUMENT_TITLE_REGEX, {
        message:
            "Title contains disallowed characters. Allowed: letters, digits, spaces, and . , - _ ( ) & + @ # : ! ?",
    })
    .openapi({
        example: "Laporan Keuangan 2026.pdf",
        description:
            "New document title. Must include the file extension — the extension cannot be changed.",
    });

export const UpdateDocumentTitleBodySchema = z.object({
    title: DocumentTitleSchema,
});

export type UpdateDocumentTitleBody = z.infer<typeof UpdateDocumentTitleBodySchema>;

export const UpdateDocumentTitleParamsSchema = z.object({
    documentId: z.string().uuid(),
    tenantId: z.string(),
    title: z.string(),
    clientIp: z.string().optional(),
    userAgent: z.string().optional(),
    logContext: z.any().optional(),
});

export type UpdateDocumentTitleParams = z.infer<typeof UpdateDocumentTitleParamsSchema>;

export const UpdateDocumentTitleResponseSchema = z.object({
    success: z.boolean().openapi({ example: true }),
    message: z.string().openapi({ example: "Document title updated" }),
    documentId: z.string().uuid(),
    title: z.string().openapi({
        example: "Laporan Keuangan 2026.pdf",
        description: "The stored title after the update, including the file extension",
    }),
});

export type UpdateDocumentTitleResponse = z.infer<typeof UpdateDocumentTitleResponseSchema>;
