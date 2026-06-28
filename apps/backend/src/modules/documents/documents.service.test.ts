import { describe, it, beforeAll, afterAll } from "jsr:@std/testing/bdd";
import { assertEquals, assertRejects, assertExists } from "jsr:@std/assert";
import { DocumentsService } from "./documents.service.ts";
import { AppError } from "../../shared/utils/errors.util.ts";
import { db } from "../../config/drizzle.ts";
import { documents, tenants } from "../../shared/models/db.model.ts";
import { eq } from "drizzle-orm";
import * as s3Util from "../../shared/utils/s3.util.ts";

describe("DocumentsService Isolated Tests", () => {
    const TEST_TENANT_ID = crypto.randomUUID();
    const originalFetch = globalThis.fetch;

    beforeAll(async () => {
        // Create dummy tenant for DB constraints
        await db.insert(tenants).values({
            id: TEST_TENANT_ID,
            name: "Docs Service Test Tenant"
        }).onConflictDoNothing();

        // Mock global fetch for AWS SDK S3 requests
        globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
            const urlStr = typeof input === "string" ? input : (input as Request).url;
            if (urlStr.includes("not-exist")) {
                return new Response(null, { status: 404 });
            }
            return new Response(null, { status: 200 });
        };
    });

    afterAll(async () => {
        globalThis.fetch = originalFetch;

        // Cleanup DB
        await db.delete(documents).where(eq(documents.tenantId, TEST_TENANT_ID));
        await db.delete(tenants).where(eq(tenants.id, TEST_TENANT_ID));
    });

    describe("createPresignedUrl", () => {
        it("negative: rejects file size over 25MB", async () => {
            await assertRejects(
                () => DocumentsService.createPresignedUrl(TEST_TENANT_ID, "big.pdf", "application/pdf", 30 * 1024 * 1024),
                AppError,
                "File size exceeds maximum allowed size"
            );
        });

        it("positive: creates presigned URL and pending DB record", async () => {
            const res = await DocumentsService.createPresignedUrl(TEST_TENANT_ID, "test.pdf", "application/pdf", 1024 * 1024);
            
            assertExists(res.url);
            assertEquals(res.url.includes("X-Amz-Signature"), true);
            assertExists(res.documentId);
            assertEquals(res.expiresIn, 900);

            // Verify it was inserted in DB
            const docs = await db.select().from(documents).where(eq(documents.id, res.documentId));
            assertEquals(docs.length, 1);
            assertEquals(docs[0].status, "pending");
            assertEquals(docs[0].title, "test.pdf");
        });
    });

    describe("confirmUpload", () => {
        it("negative: rejects if document not found in DB", async () => {
            const fakeDocId = crypto.randomUUID(); // valid UUID syntax
            await assertRejects(
                () => DocumentsService.confirmUpload(TEST_TENANT_ID, fakeDocId),
                AppError,
                "Document not found"
            );
        });

        it("negative: rejects if file does not exist in S3", async () => {
            const docId = crypto.randomUUID();
            await db.insert(documents).values({
                id: docId,
                tenantId: TEST_TENANT_ID,
                title: "missing.pdf",
                storagePath: `${docId}.pdf`,
                sizeBytes: 100,
                description: "",
                status: "pending",
            });

            await assertRejects(
                () => DocumentsService.confirmUpload(TEST_TENANT_ID, docId),
                AppError,
                "File not found in storage"
            );
        });

        it("positive: returns early if already confirmed", async () => {
            const docId = crypto.randomUUID();
            await db.insert(documents).values({
                id: docId,
                tenantId: TEST_TENANT_ID,
                title: "done.pdf",
                storagePath: `${docId}.pdf`,
                sizeBytes: 100,
                description: "",
                status: "confirmed", // already confirmed
            });

            const res = await DocumentsService.confirmUpload(TEST_TENANT_ID, docId);
            assertEquals(res.message, "Document already confirmed");
        });
    });
});
