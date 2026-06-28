import "jsr:@std/dotenv/load";
import { assertEquals } from "@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { checkObjectExists } from "./s3.util.ts";
import { getEnv } from "../../config/env.ts";

describe("S3 Utility", () => {
    it("checkObjectExists returns false for non-existent key", async () => {
        const bucketName = getEnv("S3_BUCKET_NAME");
        // Ensure bucketName exists before hitting AWS
        if (bucketName) {
            const exists = await checkObjectExists(bucketName, "non-existent-key");
            assertEquals(exists, false);
        }
    });
});
