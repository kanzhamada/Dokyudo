import { S3Client, PutBucketCorsCommand } from "npm:@aws-sdk/client-s3";
import "jsr:@std/dotenv/load";

async function main() {
    const endpoint = Deno.env.get("S3_ENDPOINT");
    const region = Deno.env.get("S3_REGION") || "us-east-1";
    const accessKeyId = Deno.env.get("S3_ACCESS_KEY");
    const secretAccessKey = Deno.env.get("S3_SECRET_KEY");
    const useSSL = Deno.env.get("S3_USE_SSL") === "true";
    const portStr = Deno.env.get("S3_PORT");
    const port = portStr ? parseInt(portStr, 10) : (useSSL ? 443 : 80);
    const protocol = useSSL ? "https" : "http";

    const client = new S3Client({
        endpoint: `${protocol}://${endpoint}${portStr ? `:${port}` : ""}`,
        region,
        credentials: {
            accessKeyId: accessKeyId || "",
            secretAccessKey: secretAccessKey || "",
        },
        forcePathStyle: true,
    });

    const bucketName = Deno.env.get("S3_DOCUMENTS_BUCKET") || "dokyudo-documents";

    const command = new PutBucketCorsCommand({
        Bucket: bucketName,
        CORSConfiguration: {
            CORSRules: [
                {
                    AllowedHeaders: ["*"],
                    AllowedMethods: ["PUT", "POST", "DELETE", "GET", "HEAD"],
                    AllowedOrigins: ["*"],
                    ExposeHeaders: ["ETag"],
                    MaxAgeSeconds: 3000,
                },
            ],
        },
    });

    try {
        await client.send(command);
        console.log(`Successfully set CORS on ${bucketName}`);
    } catch (err) {
        console.error("Error setting CORS:", err);
    }
}

main();
