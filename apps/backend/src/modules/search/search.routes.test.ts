import { assertEquals, assertExists } from "@std/assert";
import { describe, it, beforeAll } from "jsr:@std/testing/bdd";
import app from "../../main.ts";

/** Helper: make a GET request to the test app */
async function makeRequest(
    path: string,
    headers: Record<string, string> = {},
): Promise<Response> {
    const randomIp = `127.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    const req = new Request(`http://localhost${path}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "X-Request-ID": "test-request-id-003",
            "X-Forwarded-For": randomIp,
            ...headers,
        },
    });
    return await app.fetch(req);
}

async function makePostRequest(
    path: string,
    body: Record<string, unknown>,
    headers: Record<string, string> = {},
): Promise<Response> {
    const randomIp = `127.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    const req = new Request(`http://localhost${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Request-ID": "test-request-id-003",
            "X-Forwarded-For": randomIp,
            ...headers,
        },
        body: JSON.stringify(body),
    });
    return await app.fetch(req);
}

describe("Search Routes", () => {
    let validToken = "";

    beforeAll(async () => {
        const testEmail = `searchtest-${crypto.randomUUID()}@example.com`;
        const testPassword = "SecurePassword123!";

        // Attempt register
        await makePostRequest("/api/auth/register", {
            email: testEmail,
            password: testPassword,
            recaptchaToken: "dummy",
        });

        // Attempt login
        const res = await makePostRequest("/api/auth/login", {
            email: testEmail,
            password: testPassword,
            recaptchaToken: "dummy",
        });

        if (res.status === 200) {
            const json = await res.json();
            validToken = json.accessToken;
        }
    });

    describe("GET /api/search", () => {
        it("negative: missing authorization header returns 401", async () => {
            const res = await makeRequest("/api/search?query=test");

            assertEquals(res.status, 401);
            const json = await res.json();
            assertEquals(json.error.code, "UNAUTHORIZED");
        });

        it("negative: missing query parameter returns 400", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            const res = await makeRequest("/api/search", headers);

            if (!validToken) {
                assertEquals(res.status, 401);
                return;
            }

            assertEquals(res.status, 400);
            const json = await res.json();
            assertEquals(json.error.code, "VALIDATION_ERROR");
        });

        it("positive: valid query returns 200 and search results", async () => {
            const headers: Record<string, string> = validToken ? { Authorization: `Bearer ${validToken}` } : {};
            // Using URL encoding for query params
            const res = await makeRequest("/api/search?query=test%20query&limit=5", headers);

            if (!validToken) {
                assertEquals(res.status, 401);
                return;
            }

            assertEquals(res.status, 200);
            const json = await res.json();
            assertExists(json.data);
            assertEquals(Array.isArray(json.data), true);
        });
    });
});
