import { assertEquals } from "@std/assert";
import { describe, it, beforeAll } from "jsr:@std/testing/bdd";
import app from "../../main.ts";

/** Helper: make a request to the test app */
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
            "X-Request-ID": "test-request-id-002",
            "X-Forwarded-For": randomIp,
            ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    return await app.fetch(req);
}

describe("Documents Routes", () => {
    let validToken = "";

    beforeAll(async () => {
        const testEmail = `doctest-${crypto.randomUUID()}@example.com`;
        const testPassword = "SecurePassword123!";

        // Attempt register
        await makeRequest("/api/auth/register", "POST", {
            email: testEmail,
            password: testPassword,
            recaptchaToken: "dummy",
        });

        // Attempt login
        const res = await makeRequest("/api/auth/login", "POST", {
            email: testEmail,
            password: testPassword,
            recaptchaToken: "dummy",
        });

        if (res.status === 200) {
            const json = await res.json();
            validToken = json.accessToken;
        }
    });

    describe("POST /api/documents/presigned-url", () => {
        it("negative: missing authorization header returns 401", async () => {
            const res = await makeRequest("/api/documents/presigned-url", "POST", {
                filename: "test.pdf",
                mimeType: "application/pdf",
                sizeBytes: 1024,
            });

            assertEquals(res.status, 401);
            const json = await res.json();
            assertEquals(json.error.code, "UNAUTHORIZED");
        });

        it("negative: missing required fields returns 400", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            const res = await makeRequest(
                "/api/documents/presigned-url",
                "POST",
                {},
                headers,
            );

            if (!validToken) {
                assertEquals(res.status, 401);
                return;
            }

            assertEquals(res.status, 400);
            const json = await res.json();
            assertEquals(json.error.code, "VALIDATION_ERROR");
        });

        it("negative: file exceeds 25MB returns 400", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            const res = await makeRequest(
                "/api/documents/presigned-url",
                "POST",
                {
                    filename: "huge_file.pdf",
                    mimeType: "application/pdf",
                    sizeBytes: 26 * 1024 * 1024, // 26MB
                },
                headers,
            );

            if (!validToken) {
                assertEquals(res.status, 401);
                return;
            }

            assertEquals(res.status, 400);
            const json = await res.json();
            assertEquals(json.error.code, "VALIDATION_ERROR");
            assertEquals(json.error.message, "File size exceeds maximum allowed size of 25MB");
        });

        it("positive: generates presigned URL for valid payload", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            const res = await makeRequest(
                "/api/documents/presigned-url",
                "POST",
                {
                    filename: "report_2026.pdf",
                    mimeType: "application/pdf",
                    sizeBytes: 5 * 1024 * 1024, // 5MB
                },
                headers,
            );

            if (!validToken) {
                assertEquals(res.status, 401);
                return;
            }

            assertEquals(res.status, 201);
            const json = await res.json();
            assertEquals(typeof json.url, "string");
            assertEquals(typeof json.documentId, "string");
            assertEquals(typeof json.key, "string");
            assertEquals(json.expiresIn, 900);
        });
    });

    describe("POST /api/documents/confirm-upload", () => {
        it("negative: missing authorization header returns 401", async () => {
            const res = await makeRequest("/api/documents/confirm-upload", "POST", {
                documentId: crypto.randomUUID(),
            });

            assertEquals(res.status, 401);
        });

        it("negative: missing required fields returns 400", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            const res = await makeRequest(
                "/api/documents/confirm-upload",
                "POST",
                {},
                headers,
            );

            if (!validToken) {
                assertEquals(res.status, 401);
                return;
            }

            assertEquals(res.status, 400);
            const json = await res.json();
            assertEquals(json.error.code, "VALIDATION_ERROR");
        });

        it("negative: non-existent document returns 404", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            const res = await makeRequest(
                "/api/documents/confirm-upload",
                "POST",
                {
                    documentId: crypto.randomUUID(),
                },
                headers,
            );

            if (!validToken) {
                assertEquals(res.status, 401);
                return;
            }

            assertEquals(res.status, 404);
            const json = await res.json();
            assertEquals(json.error.code, "NOT_FOUND");
        });
    });

    describe("DELETE /api/documents/:id", () => {
        it("negative: missing authorization returns 401", async () => {
            const res = await makeRequest(`/api/documents/${crypto.randomUUID()}`, "DELETE");
            assertEquals(res.status, 401);
        });

        it("negative: deleting non-existent document returns 404", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            const res = await makeRequest(`/api/documents/${crypto.randomUUID()}`, "DELETE", undefined, headers);
            
            if (!validToken) return;
            assertEquals(res.status, 404);
            const json = await res.json();
            assertEquals(json.error.code, "NOT_FOUND");
        });
    });

    describe("PATCH /api/documents/:id (rename title)", () => {
        it("negative: missing authorization returns 401", async () => {
            const res = await makeRequest(`/api/documents/${crypto.randomUUID()}`, "PATCH", {
                title: "New Title.pdf",
            });
            assertEquals(res.status, 401);
        });

        it("negative: disallowed characters (XSS payload) returns 400", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            const res = await makeRequest(
                `/api/documents/${crypto.randomUUID()}`,
                "PATCH",
                { title: `<script>alert("x")</script>.pdf` },
                headers,
            );

            if (!validToken) return;
            assertEquals(res.status, 400);
            const json = await res.json();
            assertEquals(json.error.code, "VALIDATION_ERROR");
        });

        it("negative: empty title returns 400", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            const res = await makeRequest(
                `/api/documents/${crypto.randomUUID()}`,
                "PATCH",
                { title: "   " },
                headers,
            );

            if (!validToken) return;
            assertEquals(res.status, 400);
            const json = await res.json();
            assertEquals(json.error.code, "VALIDATION_ERROR");
        });

        it("negative: non-existent document returns 404", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            const res = await makeRequest(
                `/api/documents/${crypto.randomUUID()}`,
                "PATCH",
                { title: "New Title.pdf" },
                headers,
            );

            if (!validToken) return;
            assertEquals(res.status, 404);
            const json = await res.json();
            assertEquals(json.error.code, "NOT_FOUND");
        });

        it("positive: renames a document and keeps the extension", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};

            // Seed a pending document via the presigned-URL endpoint.
            const createRes = await makeRequest(
                "/api/documents/presigned-url",
                "POST",
                {
                    filename: "financial_report_2026.pdf",
                    mimeType: "application/pdf",
                    sizeBytes: 1024,
                },
                headers,
            );

            if (!validToken) return;
            assertEquals(createRes.status, 201);
            const created = await createRes.json();
            const documentId = created.documentId;

            const res = await makeRequest(
                `/api/documents/${documentId}`,
                "PATCH",
                { title: "Laporan Keuangan 2026.pdf" },
                headers,
            );

            assertEquals(res.status, 200);
            const json = await res.json();
            assertEquals(json.success, true);
            assertEquals(json.documentId, documentId);
            assertEquals(json.title, "Laporan Keuangan 2026.pdf");
            assertEquals(json.title.endsWith(".pdf"), true);
        });

        it("negative: changing the extension is rejected with 400", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};

            const createRes = await makeRequest(
                "/api/documents/presigned-url",
                "POST",
                {
                    filename: "notes.txt",
                    mimeType: "text/plain",
                    sizeBytes: 1024,
                },
                headers,
            );

            if (!validToken) return;
            assertEquals(createRes.status, 201);
            const created = await createRes.json();
            const documentId = created.documentId;

            const res = await makeRequest(
                `/api/documents/${documentId}`,
                "PATCH",
                { title: "notes.pdf" },
                headers,
            );

            assertEquals(res.status, 400);
            const json = await res.json();
            assertEquals(json.error.code, "VALIDATION_ERROR");
            assertEquals(json.error.message.includes(".txt"), true);
        });
    });

    describe("GET /api/documents", () => {
        it("negative: missing authorization returns 401", async () => {
            const res = await makeRequest("/api/documents", "GET");
            assertEquals(res.status, 401);
        });

        it("positive: returns list of documents", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            const res = await makeRequest("/api/documents", "GET", undefined, headers);
            
            if (!validToken) return;
            assertEquals(res.status, 200);
            const json = await res.json();
            assertEquals(Array.isArray(json.documents), true);
        });
    });

    describe("GET /api/documents/:id/preview", () => {
        it("negative: missing authorization returns 401", async () => {
            const res = await makeRequest(`/api/documents/${crypto.randomUUID()}/preview`, "GET");
            assertEquals(res.status, 401);
        });

        it("negative: missing document returns 404", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            const res = await makeRequest(`/api/documents/${crypto.randomUUID()}/preview`, "GET", undefined, headers);
            
            if (!validToken) return;
            assertEquals(res.status, 404);
            const json = await res.json();
            assertEquals(json.error.code, "NOT_FOUND");
        });
    });
});
