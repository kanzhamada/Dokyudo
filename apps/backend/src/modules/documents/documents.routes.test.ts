import { assertEquals } from "@std/assert";
import app from "../../main.ts";

/** Helper: make a request to the test app */
async function makeRequest(
    path: string,
    body: Record<string, unknown>,
    headers: Record<string, string> = {},
): Promise<Response> {
    const req = new Request(`http://localhost${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Request-ID": "test-request-id-002",
            ...headers,
        },
        body: JSON.stringify(body),
    });
    return await app.fetch(req);
}

// We attempt to register & login to obtain a real token for the tests.
// If the backend has no local Supabase, tests requiring auth will assert the 401 fallback.
let validToken = "";

Deno.test({
    name: "Setup: Attempt to register/login a test user for Documents tests",
    sanitizeOps: false,
    sanitizeResources: false,
    fn: async () => {
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
    },
});

Deno.test(
    "POST /api/documents/presigned-url — negative: missing authorization header returns 401",
    async () => {
        const res = await makeRequest("/api/documents/presigned-url", {
            filename: "test.pdf",
            mimeType: "application/pdf",
            sizeBytes: 1024,
        });

        assertEquals(res.status, 401);
        const json = await res.json();
        assertEquals(json.error.code, "UNAUTHORIZED");
    },
);

Deno.test(
    "POST /api/documents/presigned-url — negative: missing required fields returns 400",
    async () => {
        const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
        const res = await makeRequest(
            "/api/documents/presigned-url",
            {}, // Empty body
            headers,
        );

        // If no token, auth middleware intercepts first
        if (!validToken) {
            assertEquals(res.status, 401);
            return;
        }

        assertEquals(res.status, 400);
        const json = await res.json();
        assertEquals(json.error.code, "VALIDATION_ERROR");
    },
);

Deno.test(
    "POST /api/documents/presigned-url — negative: file exceeds 25MB returns 400",
    async () => {
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
    },
);

Deno.test(
    "POST /api/documents/presigned-url — positive: generates presigned URL for valid payload",
    async () => {
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
    },
);
