import { assertEquals, assertExists } from "@std/assert";
import { describe, it, beforeAll, afterAll } from "jsr:@std/testing/bdd";
import app from "../../main.ts";
import { db } from "../../config/drizzle.ts";
import { conversations, conversationTurns, tenants, chatShares } from "../../shared/models/db.model.ts";
import { eq, sql } from "drizzle-orm";

// The public share routes need the chat_shares table (migration 0024). Skip
// those tests gracefully until the test DB has been migrated.
async function chatSharesTableExists(): Promise<boolean> {
    try {
        await db.execute(sql`SELECT 1 FROM chat_shares LIMIT 1`);
        return true;
    } catch {
        return false;
    }
}
const shareTableReady = await chatSharesTableExists();

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
    let testTenantId = "";
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
            testTenantId = decoded.tenantId;

            await db.insert(conversations).values({
                id: testConversationId,
                tenantId: testTenantId,
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

        it("positive: server handles aborted request signal without crashing", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            if (!validToken) return;

            // Create request with an AbortController signal
            const abortController = new AbortController();
            const randomIp = `127.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

            const req = new Request("http://localhost/api/rag/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Request-ID": "test-abort-rag",
                    "X-Forwarded-For": randomIp,
                    ...headers,
                },
                body: JSON.stringify({ question: "Hello, this will be aborted" }),
                signal: abortController.signal,
            });

            // Start the request, but abort it shortly after
            const fetchPromise = app.fetch(req);

            // Give the server a small window to start processing, then abort
            await new Promise((r) => setTimeout(r, 10));
            abortController.abort();

            // The fetch should either resolve or reject — neither should crash the server
            let errored = false;
            try {
                const res = await fetchPromise;
                // If we got a response, the server handled it gracefully
                // Body may or may not be readable depending on timing
                if (res.body) {
                    try {
                        const reader = res.body.getReader();
                        await reader.cancel();
                    } catch (_) { /* ignore reader errors */ }
                }
            } catch (_err) {
                // AbortError is expected and fine
                errored = true;
            }

            // Verify server is still alive by making a normal request
            const healthRes = await makeRequest("/api/rag/conversations", "GET", undefined, headers);
            assertEquals(healthRes.status, 200);
        });

        it("negative: invalid retry_turn_id returns 400", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            const res = await makeRequest("/api/rag/chat", "POST", {
                question: "test",
                conversation_id: testConversationId,
                retry_turn_id: "not-a-uuid",
                useByok: false,
            }, headers);

            if (!validToken) return;
            assertEquals(res.status, 400);
            const json = await res.json();
            assertEquals(json.error.code, "VALIDATION_ERROR");
        });

        it("negative: invalid selected_variant_id returns 400", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            const res = await makeRequest("/api/rag/chat", "POST", {
                question: "test",
                conversation_id: testConversationId,
                selected_variant_id: "not-a-uuid",
                useByok: false,
            }, headers);

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

        it("positive: updates isPinned successfully", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            const res = await makeRequest(`/api/rag/conversations/${testConversationId}`, "PATCH", { isPinned: true }, headers);
            
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

    describe("PATCH /api/rag/conversations/:id/turns/:turnId/feedback", () => {
        it("positive: sets feedback on a turn", async () => {
            // Same defensive pattern as the other positive route tests: without a
            // valid token (e.g. Supabase email confirmation disabled in the env),
            // the test is skipped rather than crashing on the DB seed below.
            if (!validToken) return;
            const headers: Record<string, string> = { Authorization: `Bearer ${validToken}` };
            const turnId = crypto.randomUUID();
            await db.insert(conversationTurns).values({
                id: turnId,
                tenantId: testTenantId,
                conversationId: testConversationId,
                question: "Route feedback Q",
                answer: "Route feedback A",
                modelUsed: "gemini",
                status: "complete",
            });

            const res = await makeRequest(
                `/api/rag/conversations/${testConversationId}/turns/${turnId}/feedback`,
                "PATCH",
                { rating: "good" },
                headers,
            );

            assertEquals(res.status, 200);
            const json = await res.json();
            assertEquals(json.data.success, true);
        });

        it("negative: invalid rating returns 400 validation error", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            const res = await makeRequest(
                `/api/rag/conversations/${testConversationId}/turns/${crypto.randomUUID()}/feedback`,
                "PATCH",
                { rating: "meh" },
                headers,
            );

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

        it("positive: returns limited list of conversations with query param", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            const res = await makeRequest("/api/rag/conversations?limit=1", "GET", undefined, headers);
            
            if (!validToken) return;
            assertEquals(res.status, 200);
            const json = await res.json();
            assertExists(json.conversations);
            assertEquals(Array.isArray(json.conversations), true);
            assertEquals(json.conversations.length <= 1, true);
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

    describe("DELETE /api/rag/conversations/:id/turns/:turnId", () => {
        it("negative: returns 404 for non-existent turn", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            const res = await makeRequest(
                `/api/rag/conversations/${testConversationId}/turns/${crypto.randomUUID()}`,
                "DELETE",
                undefined,
                headers
            );

            if (!validToken) return;
            assertEquals(res.status, 404);
            const json = await res.json();
            assertEquals(json.error.code, "NOT_FOUND");
        });
    });

    describe("Public Share Routes", { ignore: !shareTableReady }, () => {
        const shareConversationId = crypto.randomUUID();
        let shareCode = "";
        let createdShareCode = "";

        beforeAll(async () => {
            // Register/login may fail in this environment (e.g. email
            // confirmation enabled) — the existing suites handle that with
            // early returns per test; skip the DB seed here too.
            if (!validToken) return;
            await db
                .insert(conversations)
                .values({
                    id: shareConversationId,
                    tenantId: testTenantId,
                    title: "Share Route Test Conversation",
                })
                .onConflictDoNothing();
            await db.insert(conversationTurns).values({
                id: crypto.randomUUID(),
                tenantId: testTenantId,
                conversationId: shareConversationId,
                question: "Route share Q",
                answer: "Route share A",
                status: "complete",
            });
        });

        afterAll(async () => {
            await db
                .delete(chatShares)
                .where(eq(chatShares.conversationId, shareConversationId));
            await db
                .delete(conversationTurns)
                .where(eq(conversationTurns.conversationId, shareConversationId));
            await db
                .delete(conversations)
                .where(eq(conversations.id, shareConversationId));
        });

        it("POST /conversations/:id/share negative: missing authorization returns 401", async () => {
            const res = await makeRequest(
                `/api/rag/conversations/${shareConversationId}/share`,
                "POST",
                { expires_in_hours: 24 },
            );
            assertEquals(res.status, 401);
        });

        it("POST /conversations/:id/share positive: creates a share", async () => {
            const headers: Record<string, string> = validToken
                ? { Authorization: `Bearer ${validToken}` }
                : {};
            const res = await makeRequest(
                `/api/rag/conversations/${shareConversationId}/share`,
                "POST",
                { expires_in_hours: 24 },
                headers,
            );

            if (!validToken) return;
            assertEquals(res.status, 200);
            const json = await res.json();
            assertEquals(json.code.length > 0, true);
            createdShareCode = json.code;
        });

        it("GET /shares/:code public: 200 without token", async () => {
            if (!createdShareCode) return;
            const res = await makeRequest(`/api/rag/shares/${createdShareCode}`, "GET");
            assertEquals(res.status, 200);
            const json = await res.json();
            assertEquals(json.title, "Share Route Test Conversation");
            assertEquals(Array.isArray(json.turns), true);
            assertEquals(json.conversationId, shareConversationId);
        });

        it("GET /shares/:code public: with token also 200", async () => {
            if (!createdShareCode) return;
            const headers: Record<string, string> = validToken
                ? { Authorization: `Bearer ${validToken}` }
                : {};
            const res = await makeRequest(`/api/rag/shares/${createdShareCode}`, "GET", undefined, headers);
            assertEquals(res.status, 200);
        });

        it("GET /shares/:code public: 404 for unknown code", async () => {
            const res = await makeRequest(`/api/rag/shares/tidakada12`, "GET");
            assertEquals(res.status, 404);
        });

        it("GET /shares/:code negative: 400 for invalid code format", async () => {
            const res = await makeRequest(`/api/rag/shares/!!bad`, "GET");
            assertEquals(res.status, 400);
        });

        it("POST /shares/:code/continue negative: missing authorization returns 401", async () => {
            const res = await makeRequest(
                `/api/rag/shares/${createdShareCode || "abcdefgh"}/continue`,
                "POST",
            );
            assertEquals(res.status, 401);
        });

        it("GET /conversations/:id/shares positive: lists active shares", async () => {
            if (!createdShareCode) return;
            const headers: Record<string, string> = validToken
                ? { Authorization: `Bearer ${validToken}` }
                : {};
            const res = await makeRequest(
                `/api/rag/conversations/${shareConversationId}/shares`,
                "GET",
                undefined,
                headers,
            );
            if (!validToken) return;
            assertEquals(res.status, 200);
            const json = await res.json();
            assertEquals(Array.isArray(json.shares), true);
            assertEquals(json.shares.length >= 1, true);
        });

        it("DELETE /shares/:code positive: revokes the share (link becomes 404)", async () => {
            if (!createdShareCode) return;
            const headers: Record<string, string> = validToken
                ? { Authorization: `Bearer ${validToken}` }
                : {};
            const res = await makeRequest(
                `/api/rag/shares/${createdShareCode}`,
                "DELETE",
                undefined,
                headers,
            );
            if (!validToken) return;
            assertEquals(res.status, 200);
            shareCode = createdShareCode;

            const after = await makeRequest(`/api/rag/shares/${shareCode}`, "GET");
            assertEquals(after.status, 404);
        });

        it("DELETE /conversations/:id/shares positive: stop sharing removes all", async () => {
            const headers: Record<string, string> = validToken
                ? { Authorization: `Bearer ${validToken}` }
                : {};
            if (!validToken) return;

            const res = await makeRequest(
                `/api/rag/conversations/${shareConversationId}/shares`,
                "DELETE",
                undefined,
                headers,
            );
            assertEquals(res.status, 200);
            const json = await res.json();
            assertEquals(json.data.success, true);

            const list = await makeRequest(
                `/api/rag/conversations/${shareConversationId}/shares`,
                "GET",
                undefined,
                headers,
            );
            const listJson = await list.json();
            assertEquals(listJson.shares.length, 0);
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
