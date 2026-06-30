import { AppError } from "../../shared/utils/errors.util.ts";
import { getEnv } from "../../config/env.ts";
import { generatePresignedPutUrl, checkObjectExists, deleteObject, generatePresignedGetUrl } from "../../shared/utils/s3.util.ts";
import { withAuthDb, db } from "../../config/drizzle.ts";
import { eq, and } from "drizzle-orm";
import { documents, documentChunks } from "../../shared/models/db.model.ts";
import { vectorIndex } from "../../config/vector.ts";
import * as DocumentSchema from "./documents.schema.ts";
import { MAX_DOCUMENT_SIZE_BYTES, PRESIGNED_URL_EXPIRES_IN_SECONDS, PRESIGNED_GET_URL_EXPIRES_IN_SECONDS } from "../../shared/constants/documents.constant.ts";

export class DocumentsService {
    /**
     * Generates a presigned URL and creates a pending document record.
     */
    static async createPresignedUrl(
        params: DocumentSchema.CreatePresignedUrlParams,
    ): Promise<DocumentSchema.PresignedUrlResponse> {
        
        // Enforce maximum size
        if (params.sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
            throw new AppError({
                code: "VALIDATION_ERROR",
                message: `File size exceeds maximum allowed size of ${MAX_DOCUMENT_SIZE_BYTES / (1024 * 1024)}MB`,
                status: 400,
            });
        }

        const docId = crypto.randomUUID();
        const ext = params.filename.includes(".") ? params.filename.split(".").pop() : "bin";
        const objectKey = `${params.tenantId}/${docId}.${ext}`;

        const bucketName = getEnv("S3_BUCKET_NAME");

        let url: string | null = null;
        try {
            url = await generatePresignedPutUrl(
                bucketName,
                objectKey,
                params.mimeType,
                PRESIGNED_URL_EXPIRES_IN_SECONDS,
            );
        } catch (err: any) {
            if (params.logContext) {
                params.logContext.s3Error = "Failed to generate presigned URL: " + err.message;
            }
        }

        if (!url) {
            throw new AppError({
                code: "INTERNAL_ERROR",
                message: "Failed to communicate with storage service",
                status: 500,
            });
        }

        let dbInsertSuccess = false;
        try {
            await withAuthDb(params.tenantId, async (tx) => {
                await tx.insert(documents).values({
                    id: docId,
                    tenantId: params.tenantId,
                    title: params.filename,
                    storagePath: `${docId}.${ext}`,
                    sizeBytes: params.sizeBytes,
                    description: "",
                    status: "pending",
                });
            });
            dbInsertSuccess = true;
        } catch (err: any) {
            if (params.logContext) {
                params.logContext.dbError = "Failed to insert pending document: " + err.message;
            }
        }

        if (!dbInsertSuccess) {
            throw new AppError({
                code: "INTERNAL_ERROR",
                message: "Failed to register document in database",
                status: 500,
            });
        }

        return {
            url,
            documentId: docId,
            key: objectKey,
            expiresIn: PRESIGNED_URL_EXPIRES_IN_SECONDS,
        };
    }

    /**
     * Confirms that a document was successfully uploaded to MinIO.
     */
    static async confirmUpload(
        params: DocumentSchema.ConfirmUploadParams,
    ): Promise<DocumentSchema.ConfirmUploadResponse> {
        let doc: any = null;
        let dbQueryError = false;

        try {
            await withAuthDb(params.tenantId, async (tx) => {
                const results = await tx.select().from(documents).where(
                    and(
                        eq(documents.id, params.documentId),
                        eq(documents.tenantId, params.tenantId)
                    )
                );
                if (results.length > 0) {
                    doc = results[0];
                }
            });
        } catch (err: any) {
            if (params.logContext) {
                params.logContext.dbError = "Failed to fetch document for confirmation: " + err.message;
            }
            dbQueryError = true;
        }

        if (dbQueryError) {
            throw new AppError({
                code: "INTERNAL_ERROR",
                message: "Failed to query document",
                status: 500,
            });
        }

        if (!doc) {
            throw new AppError({
                code: "NOT_FOUND",
                message: "Document not found",
                status: 404,
            });
        }

        if (doc.status === "confirmed") {
            return {
                message: "Document already confirmed",
                documentId: params.documentId,
                status: "confirmed",
            };
        }

        const bucketName = getEnv("S3_BUCKET_NAME");
        const objectKey = `${params.tenantId}/${doc.storagePath}`;

        let exists = false;
        let s3CheckError = false;
        try {
            exists = await checkObjectExists(bucketName, objectKey);
        } catch (err: any) {
            if (params.logContext) {
                params.logContext.s3Error = "Failed to check object existence in S3: " + err.message;
            }
            s3CheckError = true;
        }

        if (s3CheckError) {
            throw new AppError({
                code: "INTERNAL_ERROR",
                message: "Failed to communicate with storage service",
                status: 500,
            });
        }

        if (!exists) {
            throw new AppError({
                code: "VALIDATION_ERROR",
                message: "File not found in storage. Ensure you have completed the upload.",
                status: 400,
            });
        }

        let dbUpdateSuccess = false;
        try {
            await withAuthDb(params.tenantId, async (tx) => {
                await tx.update(documents)
                    .set({ status: "confirmed" })
                    .where(
                        and(
                            eq(documents.id, params.documentId),
                            eq(documents.tenantId, params.tenantId)
                        )
                    );
            });
            dbUpdateSuccess = true;
        } catch (err: any) {
            if (params.logContext) {
                params.logContext.dbError = "Failed to update document status: " + err.message;
            }
        }

        if (!dbUpdateSuccess) {
            throw new AppError({
                code: "INTERNAL_ERROR",
                message: "Failed to update document status",
                status: 500,
            });
        }

        return {
            message: "Document uploaded and confirmed successfully",
            documentId: params.documentId,
            status: "confirmed",
        };
    }

    /**
     * Deletes a document, its chunks from vector store, and its softfile from S3.
     */
    static async deleteDocument(
        params: DocumentSchema.DeleteDocumentParams,
    ): Promise<DocumentSchema.DeleteDocumentResponse> {
        let doc: any = null;

        try {
            await withAuthDb(params.tenantId, async (tx) => {
                const results = await tx.select().from(documents).where(
                    and(
                        eq(documents.id, params.documentId),
                        eq(documents.tenantId, params.tenantId)
                    )
                );
                if (results.length > 0) {
                    doc = results[0];
                }
            });
        } catch (err: any) {
            if (params.logContext) params.logContext.dbError = "Failed to fetch document: " + err.message;
            throw new AppError({
                code: "INTERNAL_ERROR",
                message: "Database query failed",
                status: 500,
            });
        }

        if (!doc) {
            throw new AppError({
                code: "NOT_FOUND",
                message: "Document not found",
                status: 404,
            });
        }

        // 1. Fetch chunk IDs to delete from Upstash Vector
        try {
            await withAuthDb(params.tenantId, async (tx) => {
                const chunks = await tx.select({ id: documentChunks.id }).from(documentChunks).where(
                    and(
                        eq(documentChunks.documentId, params.documentId),
                        eq(documentChunks.tenantId, params.tenantId)
                    )
                );
                
                if (chunks.length > 0) {
                    const chunkIds = chunks.map(c => c.id);
                    
                    // Vector API allows bulk delete up to 1000, we can batch if needed but realistically chunkIds < 1000 per doc
                    // Delete from vector DB
                    await vectorIndex.delete(chunkIds);
                }
            });
        } catch (err: any) {
            if (params.logContext) params.logContext.vectorError = "Failed to delete from vector index: " + err.message;
            throw new AppError({
                code: "INTERNAL_ERROR",
                message: "Failed to delete vector embeddings",
                status: 500,
            });
        }

        // 2. Delete the softfile from MinIO / S3
        const bucketName = getEnv("S3_BUCKET_NAME");
        const objectKey = `${params.tenantId}/${doc.storagePath}`;
        try {
            await deleteObject(bucketName, objectKey);
        } catch (err: any) {
            if (params.logContext) params.logContext.s3Error = "Failed to delete object from S3: " + err.message;
            // Proceed even if file doesn't exist in S3 to ensure cleanup
        }

        // 3. Delete document from Postgres (Cascades to chunks in Postgres)
        try {
            await withAuthDb(params.tenantId, async (tx) => {
                await tx.delete(documents).where(
                    and(
                        eq(documents.id, params.documentId),
                        eq(documents.tenantId, params.tenantId)
                    )
                );
            });
        } catch (err: any) {
            if (params.logContext) params.logContext.dbError = "Failed to delete document from Postgres: " + err.message;
            throw new AppError({
                code: "INTERNAL_ERROR",
                message: "Failed to delete document record",
                status: 500,
            });
        }

        return {
            success: true,
            message: "Document successfully deleted",
        };
    }

    /**
     * Lists all documents for a tenant.
     */
    static async listDocuments(
        params: DocumentSchema.ListDocumentsParams,
    ): Promise<DocumentSchema.ListDocumentsResponse> {
        let docs: any[] = [];
        
        try {
            await withAuthDb(params.tenantId, async (tx) => {
                docs = await tx.select().from(documents).where(
                    eq(documents.tenantId, params.tenantId)
                );
            });
        } catch (err: any) {
            if (params.logContext) {
                params.logContext.dbError = "Failed to list documents: " + err.message;
            }
            throw new AppError({
                code: "INTERNAL_ERROR",
                message: "Database query failed",
                status: 500,
            });
        }

        const documentItems = docs.map(d => ({
            id: d.id,
            title: d.title,
            description: d.description,
            storagePath: d.storagePath,
            sizeBytes: d.sizeBytes,
            status: d.status,
            createdAt: d.createdAt.toISOString(),
        }));

        return {
            documents: documentItems,
        };
    }

    /**
     * Generates a presigned URL to view/download a document.
     */
    static async getDocumentPreview(
        params: DocumentSchema.GetDocumentPreviewParams,
    ): Promise<DocumentSchema.GetDocumentPreviewResponse> {
        let doc: any = null;

        try {
            await withAuthDb(params.tenantId, async (tx) => {
                const results = await tx.select().from(documents).where(
                    and(
                        eq(documents.id, params.documentId),
                        eq(documents.tenantId, params.tenantId)
                    )
                );
                if (results.length > 0) {
                    doc = results[0];
                }
            });
        } catch (err: any) {
            if (params.logContext) params.logContext.dbError = "Failed to fetch document: " + err.message;
            throw new AppError({
                code: "INTERNAL_ERROR",
                message: "Database query failed",
                status: 500,
            });
        }

        if (!doc) {
            throw new AppError({
                code: "NOT_FOUND",
                message: "Document not found",
                status: 404,
            });
        }

        const bucketName = getEnv("S3_BUCKET_NAME");
        const objectKey = `${params.tenantId}/${doc.storagePath}`;

        let url: string | null = null;
        try {
            url = await generatePresignedGetUrl(
                bucketName,
                objectKey,
                PRESIGNED_GET_URL_EXPIRES_IN_SECONDS,
            );
        } catch (err: any) {
            if (params.logContext) params.logContext.s3Error = "Failed to generate presigned GET URL: " + err.message;
            throw new AppError({
                code: "INTERNAL_ERROR",
                message: "Failed to communicate with storage service",
                status: 500,
            });
        }

        if (!url) {
            throw new AppError({
                code: "INTERNAL_ERROR",
                message: "Failed to generate preview URL",
                status: 500,
            });
        }

        return {
            url,
            expiresIn: PRESIGNED_GET_URL_EXPIRES_IN_SECONDS,
        };
    }
}
