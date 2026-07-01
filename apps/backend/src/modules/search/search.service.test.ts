import { describe, it, beforeAll, afterAll } from "jsr:@std/testing/bdd";
import { assertEquals, assertExists, assertRejects } from "jsr:@std/assert";
import { stub, returnsNext } from "jsr:@std/testing/mock";
import { SearchService } from "./search.service.ts";
import { db } from "../../config/drizzle.ts";
import { documentChunks, documents, tenants, tenantSubscriptions } from "../../shared/models/db.model.ts";
import { eq } from "drizzle-orm";
import { gemini } from "../../config/gemini.ts";
import { vectorIndex } from "../../config/vector.ts";
import { AppError } from "../../shared/utils/errors.util.ts";

describe("SearchService Isolated Tests", () => {
    const TEST_TENANT_ID = crypto.randomUUID();
    const TEST_DOC_ID = crypto.randomUUID();

    beforeAll(async () => {
        // Create dummy tenant and chunk for DB tests
        await db.insert(tenants).values({
            id: TEST_TENANT_ID,
            name: "Search Service Test Tenant",
        }).onConflictDoNothing();

        await db.insert(documents).values({
            id: TEST_DOC_ID,
            tenantId: TEST_TENANT_ID,
            title: "Test Document",
            storagePath: "test.pdf",
            sizeBytes: 100,
            status: "confirmed",
            description: "",
        }).onConflictDoNothing();

        await db.insert(documentChunks).values({
            id: crypto.randomUUID(),
            tenantId: TEST_TENANT_ID,
            documentId: TEST_DOC_ID,
            chunkIndex: 0,
            content: "Ini adalah dokumen dummy tentang kebijakan pengembalian barang",
        }).onConflictDoNothing();

        await db.insert(tenantSubscriptions).values({
            tenantId: TEST_TENANT_ID,
            tier: "FREE",
            searchesCount: 0,
        }).onConflictDoNothing();
    });

    afterAll(async () => {
        await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, TEST_TENANT_ID));
        await db.delete(documentChunks).where(eq(documentChunks.tenantId, TEST_TENANT_ID));
        await db.delete(documents).where(eq(documents.tenantId, TEST_TENANT_ID));
        await db.delete(tenants).where(eq(tenants.id, TEST_TENANT_ID));
    });

    describe("executeHybridSearch", () => {
        it("positive: returns hybrid search results for valid query", async () => {
            // Mock LLM Embedding to return a dummy vector
            using geminiStub = stub(gemini, "generateEmbedding", () => Promise.resolve([0.1, 0.2, 0.3]));
            
            // Mock Upstash Vector Index to return a dummy match
            using vectorStub = stub(vectorIndex, "query", () => Promise.resolve([{
                id: crypto.randomUUID(),
                score: 0.9,
            }]));

            const params = {
                tenantId: TEST_TENANT_ID,
                query: "kebijakan pengembalian",
                limit: 5,
                logContext: {},
            };

            const results = await SearchService.executeHybridSearch(params);
            
            assertExists(results);
            assertEquals(Array.isArray(results), true);
            // It should at least search the DB (FTS) and Vector (mocked)
        });

        it("negative: throws error if LLM embedding fails completely", async () => {
            // Stub gemini to throw error
            using geminiStub = stub(gemini, "generateEmbedding", () => { throw new Error("API Limit Reached"); });
            
            const params = {
                tenantId: TEST_TENANT_ID,
                query: "kebijakan pengembalian",
                limit: 5,
                logContext: {},
            };

            const results = await SearchService.executeHybridSearch(params);
            
            // It should gracefully degrade to FTS and not throw an error
            assertExists(results);
            assertEquals(Array.isArray(results), true);
        });

        it("negative: throws error if search tier limit exceeded", async () => {
            // Forcefully update the DB to reach limit for FREE
            await db.update(tenantSubscriptions)
                .set({ searchesCount: 1000 })
                .where(eq(tenantSubscriptions.tenantId, TEST_TENANT_ID));

            const params = {
                tenantId: TEST_TENANT_ID,
                query: "limit test",
                limit: 5,
                logContext: {},
            };

            await assertRejects(
                () => SearchService.executeHybridSearch(params),
                AppError,
                "Search limit exceeded"
            );

            // Reset back
            await db.update(tenantSubscriptions)
                .set({ searchesCount: 0 })
                .where(eq(tenantSubscriptions.tenantId, TEST_TENANT_ID));
        });
    });
});
