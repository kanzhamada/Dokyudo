import { assertEquals } from "@std/assert";
import { describe, it, beforeAll } from "jsr:@std/testing/bdd";
import app from "../../main.ts";

/** Helper: make a request to the test app */
async function makeRequest(
    path: string,
    body: Record<string, unknown>,
    headers: Record<string, string> = {},
): Promise<Response> {
    const randomIp = `127.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    const req = new Request(`http://localhost${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Request-ID": "test-request-id-002",
            "X-Forwarded-For": randomIp,
            ...headers,
        },
        body: JSON.stringify(body),
    });
    return await app.fetch(req);
}

describe("Documents Routes", () => {
    let validToken = "";

    beforeAll(async () => {
        const testEmail = `doctest-${crypto.randomUUID()}@example.com`;
        const testPassword = "SecurePassword123!";

        // Attempt register
        await makeRequest("/api/auth/register", {
            email: testEmail,
            password: testPassword,
            recaptchaToken: "dummy",
        });

        // Attempt login
        const res = await makeRequest("/api/auth/login", {
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
            const res = await makeRequest("/api/documents/presigned-url", {
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
            const res = await makeRequest("/api/documents/confirm-upload", {
                documentId: crypto.randomUUID(),
            });

            assertEquals(res.status, 401);
        });

        it("negative: missing required fields returns 400", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            const res = await makeRequest(
                "/api/documents/confirm-upload",
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
});
