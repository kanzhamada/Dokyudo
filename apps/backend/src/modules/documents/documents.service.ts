import { AppError } from "../../shared/utils/errors.util.ts";
import { getEnv } from "../../config/env.ts";
import { generatePresignedPutUrl, checkObjectExists } from "../../shared/utils/s3.util.ts";
import { withAuthDb } from "../../config/drizzle.ts";
import { eq, and } from "drizzle-orm";
import { documents } from "../../shared/models/db.model.ts";

export class DocumentsService {
    /**
     * Generates a presigned URL and creates a pending document record.
     */
    static async createPresignedUrl(
        tenantId: string,
        filename: string,
        mimeType: string,
        sizeBytes: number,
    ) {
        
        // Enforce maximum size (25MB)
        if (sizeBytes > 25 * 1024 * 1024) {
            throw new AppError({
                code: "VALIDATION_ERROR",
                message: "File size exceeds maximum allowed size of 25MB",
                status: 400,
            });
        }

        const docId = crypto.randomUUID();
        const ext = filename.includes(".") ? filename.split(".").pop() : "bin";
        const objectKey = `${tenantId}/${docId}.${ext}`;

        const bucketName = getEnv("S3_BUCKET_NAME");
        const expiresIn = 900; // 15 minutes

        let url: string;
        try {
            url = await generatePresignedPutUrl(
                bucketName,
                objectKey,
                mimeType,
                expiresIn,
            );
        } catch (err: any) {
            console.error("Failed to generate presigned URL:", err);
            throw new AppError({
                code: "INTERNAL_ERROR",
                message: "Failed to communicate with storage service",
                status: 500,
            });
        }

        try {
            await withAuthDb(tenantId, async (tx) => {
                await tx.insert(documents).values({
                    id: docId,
                    tenantId,
                    title: filename,
                    storagePath: `${docId}.${ext}`,
                    sizeBytes,
                    description: "",
                    status: "pending",
                });
            });
        } catch (err: any) {
            console.error("Failed to insert pending document:", err);
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
            expiresIn,
        };
    }

    /**
     * Confirms that a document was successfully uploaded to MinIO.
     */
    static async confirmUpload(tenantId: string, documentId: string) {
        let doc: any = null;

        try {
            await withAuthDb(tenantId, async (tx) => {
                const results = await tx.select().from(documents).where(
                    and(
                        eq(documents.id, documentId),
                        eq(documents.tenantId, tenantId)
                    )
                );
                if (results.length > 0) {
                    doc = results[0];
                }
            });
        } catch (err: any) {
            console.error("Failed to fetch document for confirmation:", err);
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
                documentId,
                status: "confirmed",
            };
        }

        const bucketName = getEnv("S3_BUCKET_NAME");
        const objectKey = `${tenantId}/${doc.storagePath}`;

        let exists = false;
        try {
            exists = await checkObjectExists(bucketName, objectKey);
        } catch (err: any) {
            console.error("Failed to check object existence in S3:", err);
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

        try {
            await withAuthDb(tenantId, async (tx) => {
                await tx.update(documents)
                    .set({ status: "confirmed" })
                    .where(
                        and(
                            eq(documents.id, documentId),
                            eq(documents.tenantId, tenantId)
                        )
                    );
            });
        } catch (err: any) {
            console.error("Failed to update document status:", err);
            throw new AppError({
                code: "INTERNAL_ERROR",
                message: "Failed to update document status",
                status: 500,
            });
        }

        return {
            message: "Document uploaded and confirmed successfully",
            documentId,
            status: "confirmed",
        };
    }
}
