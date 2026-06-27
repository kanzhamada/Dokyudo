import { S3Client, PutObjectCommand, HeadObjectCommand } from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";
import { getEnv } from "../../config/env.ts";

// Initialize singleton lazily or eagerly depending on usage
let s3ClientInstance: S3Client | null = null;

export function getS3Client(): S3Client {
    if (!s3ClientInstance) {
        const endpoint = getEnv("S3_ENDPOINT");
        const region = getEnv("S3_REGION") || "us-east-1";
        const accessKeyId = getEnv("S3_ACCESS_KEY");
        const secretAccessKey = getEnv("S3_SECRET_KEY");
        const useSSL = getEnv("S3_USE_SSL") === "true";
        const portStr = getEnv("S3_PORT");
        const port = portStr ? parseInt(portStr, 10) : (useSSL ? 443 : 80);
        const protocol = useSSL ? "https" : "http";

        s3ClientInstance = new S3Client({
            endpoint: `${protocol}://${endpoint}:${port}`,
            region,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
            forcePathStyle: true, // Required for MinIO
        });
    }
    return s3ClientInstance;
}

/**
 * Generates a presigned URL for a PUT request to upload an object.
 */
export async function generatePresignedPutUrl(
    bucketName: string,
    objectKey: string,
    mimeType: string,
    expiresInSecs = 900
): Promise<string> {
    const client = getS3Client();
    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        ContentType: mimeType,
    });
    
    return await getSignedUrl(client, command, { expiresIn: expiresInSecs });
}

/**
 * Checks if an object exists in the S3 bucket.
 */
export async function checkObjectExists(
    bucketName: string,
    objectKey: string
): Promise<boolean> {
    const client = getS3Client();
    const command = new HeadObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
    });
    
    try {
        await client.send(command);
        return true;
    } catch (err: any) {
        console.error("S3 HeadObject Error:", err.name, err.$metadata?.httpStatusCode, err);
        if (
            err.name === "NotFound" || 
            err.name === "NoSuchKey" || 
            err.$metadata?.httpStatusCode === 404
        ) {
            return false;
        }
        throw err;
    }
}
