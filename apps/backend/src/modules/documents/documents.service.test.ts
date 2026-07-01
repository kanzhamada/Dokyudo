import { describe, it, beforeAll, afterAll } from "jsr:@std/testing/bdd";
import { assertEquals, assertRejects, assertExists } from "jsr:@std/assert";
import { DocumentsService } from "./documents.service.ts";
import { AppError } from "../../shared/utils/errors.util.ts";
import { db } from "../../config/drizzle.ts";
import { documents, tenants, tenantSubscriptions } from "../../shared/models/db.model.ts";
import { eq } from "drizzle-orm";
import * as s3Util from "../../shared/utils/s3.util.ts";
import { stub } from "jsr:@std/testing/mock";
import { vectorIndex } from "../../config/vector.ts";

describe("DocumentsService Isolated Tests", () => {
    const TEST_TENANT_ID = crypto.randomUUID();
    const originalFetch = globalThis.fetch;

    beforeAll(async () => {
        // Create dummy tenant for DB constraints
        await db.insert(tenants).values({
            id: TEST_TENANT_ID,
            name: "Docs Service Test Tenant"
        }).onConflictDoNothing();

        await db.insert(tenantSubscriptions).values({
            tenantId: TEST_TENANT_ID,
            tier: "FREE",
            uploadsCount: 0,
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
        await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, TEST_TENANT_ID));
        await db.delete(documents).where(eq(documents.tenantId, TEST_TENANT_ID));
        await db.delete(tenants).where(eq(tenants.id, TEST_TENANT_ID));
    });

    describe("createPresignedUrl", () => {
        it("negative: rejects file size over tier limit", async () => {
            await assertRejects(
                () => DocumentsService.createPresignedUrl({
                    tenantId: TEST_TENANT_ID, 
                    filename: "big.pdf", 
                    mimeType: "application/pdf", 
                    sizeBytes: 15 * 1024 * 1024 // 15MB, exceeds FREE limit (10MB)
                }),
                AppError,
                "File size exceeds maximum allowed size"
            );
        });

        it("negative: rejects if upload quota is exceeded", async () => {
            await db.update(tenantSubscriptions)
                .set({ uploadsCount: 20 }) // > 10 for FREE
                .where(eq(tenantSubscriptions.tenantId, TEST_TENANT_ID));

            await assertRejects(
                () => DocumentsService.createPresignedUrl({
                    tenantId: TEST_TENANT_ID, 
                    filename: "test.pdf", 
                    mimeType: "application/pdf", 
                    sizeBytes: 1024 * 1024
                }),
                AppError,
                "Upload limit exceeded"
            );

            // Reset back
            await db.update(tenantSubscriptions)
                .set({ uploadsCount: 0 })
                .where(eq(tenantSubscriptions.tenantId, TEST_TENANT_ID));
        });

        it("positive: creates presigned URL and pending DB record", async () => {
            const res = await DocumentsService.createPresignedUrl({
                tenantId: TEST_TENANT_ID, 
                filename: "test.pdf", 
                mimeType: "application/pdf", 
                sizeBytes: 1024 * 1024
            });
            
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
                () => DocumentsService.confirmUpload({
                    tenantId: TEST_TENANT_ID, 
                    documentId: fakeDocId
                }),
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

            try {
                await DocumentsService.confirmUpload({
                    tenantId: TEST_TENANT_ID, 
                    documentId: docId
                });
                throw new Error("Expected to reject");
            } catch (err: any) {
                if (err.message !== "File not found in storage" && err.message !== "Failed to communicate with storage service") {
                    throw err;
                }
            }
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

            const res = await DocumentsService.confirmUpload({
                tenantId: TEST_TENANT_ID, 
                documentId: docId
            });
            assertEquals(res.message, "Document already confirmed");
        });
    });

    describe("deleteDocument", () => {
        it("negative: rejects if document not found in DB", async () => {
            const fakeDocId = crypto.randomUUID();
            await assertRejects(
                () => DocumentsService.deleteDocument({
                    tenantId: TEST_TENANT_ID,
                    documentId: fakeDocId
                }),
                AppError,
                "Document not found"
            );
        });

        it("positive: deletes document and chunks from db, vector, and s3", async () => {
            using vectorStub = stub(vectorIndex, "delete", () => Promise.resolve({ deleted: 1 }) as any);
            
            const docId = crypto.randomUUID();
            await db.insert(documents).values({
                id: docId,
                tenantId: TEST_TENANT_ID,
                title: "delete-me.pdf",
                storagePath: `${docId}.pdf`,
                sizeBytes: 100,
                description: "",
                status: "confirmed",
            });

            const res = await DocumentsService.deleteDocument({
                tenantId: TEST_TENANT_ID,
                documentId: docId
            });

            assertEquals(res.success, true);
            
            // verify db deletion
            const docs = await db.select().from(documents).where(eq(documents.id, docId));
            assertEquals(docs.length, 0);
        });
    });

    describe("listDocuments", () => {
        it("positive: returns array of documents for the tenant", async () => {
            const docId1 = crypto.randomUUID();
            const docId2 = crypto.randomUUID();

            await db.insert(documents).values([
                {
                    id: docId1,
                    tenantId: TEST_TENANT_ID,
                    title: "doc1.pdf",
                    storagePath: "doc1.pdf",
                    sizeBytes: 100,
                    description: "",
                    status: "confirmed",
                },
                {
                    id: docId2,
                    tenantId: TEST_TENANT_ID,
                    title: "doc2.pdf",
                    storagePath: "doc2.pdf",
                    sizeBytes: 200,
                    description: "",
                    status: "pending",
                }
            ]);

            const res = await DocumentsService.listDocuments({ tenantId: TEST_TENANT_ID });
            
            assertEquals(Array.isArray(res.documents), true);
            assertEquals(res.documents.length >= 2, true);
            
            const titles = res.documents.map(d => d.title);
            assertEquals(titles.includes("doc1.pdf"), true);
            assertEquals(titles.includes("doc2.pdf"), true);

            // cleanup
            await db.delete(documents).where(eq(documents.id, docId1));
            await db.delete(documents).where(eq(documents.id, docId2));
        });
    });

    describe("getDocumentPreview", () => {
        it("negative: rejects if document not found in DB", async () => {
            const fakeId = crypto.randomUUID();
            try {
                await DocumentsService.getDocumentPreview({
                    tenantId: TEST_TENANT_ID,
                    documentId: fakeId,
                });
                assertEquals(true, false, "Should have thrown AppError");
            } catch (err: any) {
                assertEquals(err.status, 404);
            }
        });

        it("positive: returns presigned GET URL and expiry time", async () => {
            const docId = crypto.randomUUID();
            await db.insert(documents).values({
                id: docId,
                tenantId: TEST_TENANT_ID,
                title: "doc3.pdf",
                storagePath: "doc3.pdf",
                sizeBytes: 100,
                description: "",
                status: "confirmed",
            });

            const res = await DocumentsService.getDocumentPreview({
                tenantId: TEST_TENANT_ID,
                documentId: docId,
            });
            
            assertEquals(typeof res.url, "string");
            assertEquals(res.url.startsWith("http"), true);
            assertEquals(res.expiresIn, 43200);

            // cleanup
            await db.delete(documents).where(eq(documents.id, docId));
        });
    });
});
