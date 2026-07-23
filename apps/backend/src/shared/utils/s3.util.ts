import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand, GetObjectCommand } from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";
import { getEnv } from "../../config/env.ts";

// Initialize singleton lazily or eagerly depending on usage
let s3ClientInstance: S3Client | null = null;
let s3InternalClientInstance: S3Client | null = null;

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

export function getS3InternalClient(): S3Client {
    if (!s3InternalClientInstance) {
        const endpoint = getEnv("S3_INTERNAL_ENDPOINT") || getEnv("S3_ENDPOINT");
        const region = getEnv("S3_REGION") || "us-east-1";
        const accessKeyId = getEnv("S3_ACCESS_KEY");
        const secretAccessKey = getEnv("S3_SECRET_KEY");
        const useSSL = (getEnv("S3_INTERNAL_USE_SSL") || getEnv("S3_USE_SSL")) === "true";
        const portStr = getEnv("S3_INTERNAL_PORT") || getEnv("S3_PORT");
        const port = portStr ? parseInt(portStr, 10) : (useSSL ? 443 : 80);
        const protocol = useSSL ? "https" : "http";

        s3InternalClientInstance = new S3Client({
            endpoint: `${protocol}://${endpoint}:${port}`,
            region,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
            forcePathStyle: true, // Required for MinIO
        });
    }
    return s3InternalClientInstance;
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
 * Generates a presigned URL for a GET request to download/view an object.
 */
export async function generatePresignedGetUrl(
    bucketName: string,
    objectKey: string,
    expiresInSecs = 900,
    filename?: string
): Promise<string> {
    const client = getS3Client();
    const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        ResponseContentDisposition: filename
            ? `attachment; filename="${encodeURIComponent(filename)}"`
            : undefined,
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
    const client = getS3InternalClient();
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

/**
 * Deletes an object from the S3 bucket.
 */
export async function deleteObject(
    bucketName: string,
    objectKey: string
): Promise<void> {
    const client = getS3InternalClient();
    const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
    });
    
    try {
        await client.send(command);
    } catch (err: any) {
        console.error("S3 DeleteObject Error:", err.name, err.$metadata?.httpStatusCode, err);
        throw err;
    }
}
