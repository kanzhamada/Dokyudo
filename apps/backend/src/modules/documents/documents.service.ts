import { AppError } from "../../shared/utils/errors.util.ts";
import { getEnv } from "../../config/env.ts";
import { generatePresignedPutUrl } from "../../shared/utils/s3.util.ts";
import { withAuthDb } from "../../config/drizzle.ts";
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
}
