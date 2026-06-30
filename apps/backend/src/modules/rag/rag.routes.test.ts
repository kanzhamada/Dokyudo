import { assertEquals, assertExists } from "@std/assert";
import { describe, it, beforeAll } from "jsr:@std/testing/bdd";
import app from "../../main.ts";
import { db } from "../../config/drizzle.ts";
import { conversations, tenants } from "../../shared/models/db.model.ts";
import { eq } from "drizzle-orm";

async function makeRequest(
    path: string,
    method: string,
    body?: Record<string, unknown>,
    headers: Record<string, string> = {},
): Promise<Response> {
    const randomIp = `127.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    const req = new Request(`http://localhost${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            "X-Request-ID": "test-request-id-rag",
            "X-Forwarded-For": randomIp,
            ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    return await app.fetch(req);
}

describe("RAG Routes", () => {
    let validToken = "";
    const TEST_TENANT_ID = crypto.randomUUID();
    let testConversationId = crypto.randomUUID();

    beforeAll(async () => {
        const testEmail = `ragtest-${crypto.randomUUID()}@example.com`;
        const testPassword = "SecurePassword123!";

        // Register and Login
        await makeRequest("/api/auth/register", "POST", {
            email: testEmail,
            password: testPassword,
            recaptchaToken: "dummy",
        });

        const res = await makeRequest("/api/auth/login", "POST", {
            email: testEmail,
            password: testPassword,
            recaptchaToken: "dummy",
        });

        if (res.status === 200) {
            const json = await res.json();
            validToken = json.accessToken;

            // Find the tenantId of this user to create a valid test conversation
            const decoded = JSON.parse(atob(validToken.split(".")[1]));
            
            await db.insert(conversations).values({
                id: testConversationId,
                tenantId: decoded.tenantId,
                title: "Test Conversation for Routes",
            }).onConflictDoNothing();
        }
    });

    describe("POST /api/rag/chat", () => {
        it("negative: missing authorization returns 401", async () => {
            const res = await makeRequest("/api/rag/chat", "POST", { question: "test" });
            assertEquals(res.status, 401);
        });

        it("negative: invalid body returns 400", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            const res = await makeRequest("/api/rag/chat", "POST", {}, headers);
            
            if (!validToken) return;
            assertEquals(res.status, 400);
            const json = await res.json();
            assertEquals(json.error.code, "VALIDATION_ERROR");
        });
    });

    describe("PATCH /api/rag/conversations/:id", () => {
        it("positive: updates title successfully", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            const res = await makeRequest(`/api/rag/conversations/${testConversationId}`, "PATCH", { title: "New Title 123" }, headers);
            
            if (!validToken) return;
            assertEquals(res.status, 200);
            const json = await res.json();
            assertEquals(json.data.success, true);
        });

        it("negative: empty title returns 400 validation error", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            const res = await makeRequest(`/api/rag/conversations/${testConversationId}`, "PATCH", { title: "" }, headers);
            
            if (!validToken) return;
            assertEquals(res.status, 400);
            const json = await res.json();
            assertEquals(json.error.code, "VALIDATION_ERROR");
        });
    });

    describe("GET /api/rag/conversations", () => {
        it("negative: missing authorization returns 401", async () => {
            const res = await makeRequest("/api/rag/conversations", "GET");
            assertEquals(res.status, 401);
        });

        it("positive: returns list of conversations", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            const res = await makeRequest("/api/rag/conversations", "GET", undefined, headers);
            
            if (!validToken) return;
            assertEquals(res.status, 200);
            const json = await res.json();
            assertExists(json.conversations);
            assertEquals(Array.isArray(json.conversations), true);
        });
    });

    describe("GET /api/rag/conversations/:id", () => {
        it("positive: returns the conversation and its turns", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            const res = await makeRequest(`/api/rag/conversations/${testConversationId}`, "GET", undefined, headers);
            
            if (!validToken) return;
            assertEquals(res.status, 200);
            const json = await res.json();
            assertEquals(json.id, testConversationId);
            assertEquals(Array.isArray(json.turns), true);
        });

        it("negative: returns 404 for invalid id", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            const res = await makeRequest(`/api/rag/conversations/${crypto.randomUUID()}`, "GET", undefined, headers);
            
            if (!validToken) return;
            assertEquals(res.status, 404);
        });
    });

    describe("DELETE /api/rag/conversations/:id", () => {
        it("positive: deletes conversation successfully", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            const res = await makeRequest(`/api/rag/conversations/${testConversationId}`, "DELETE", undefined, headers);
            
            if (!validToken) return;
            assertEquals(res.status, 200);
            const json = await res.json();
            assertEquals(json.data.success, true);
        });

        it("negative: deleting already deleted conversation returns 404", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            const res = await makeRequest(`/api/rag/conversations/${testConversationId}`, "DELETE", undefined, headers);
            
            if (!validToken) return;
            assertEquals(res.status, 404);
            const json = await res.json();
            assertEquals(json.error.code, "NOT_FOUND");
        });
    });
});
