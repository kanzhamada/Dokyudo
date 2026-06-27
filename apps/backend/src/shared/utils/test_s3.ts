import "jsr:@std/dotenv/load";
import { checkObjectExists } from "./s3.util.ts";
import { getEnv } from "../../config/env.ts";

async function main() {
    const bucketName = getEnv("S3_BUCKET_NAME");
    console.log("Bucket:", bucketName);
    try {
        const exists = await checkObjectExists(bucketName, "non-existent-key");
        console.log("Exists:", exists);
    } catch (err) {
        console.error("Raw S3 Error:", err);
    }
}

main();
