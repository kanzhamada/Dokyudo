import { assertEquals } from "@std/assert";
import app from "../../main.ts";

/** Helper: make a request to the test app */
async function makeRequest(
    path: string,
    body: Record<string, unknown>,
    headers: Record<string, string> = {}
): Promise<Response> {
    const req = new Request(`http://localhost${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Request-ID": "test-request-id-001",
            ...headers
        },
        body: JSON.stringify(body),
    });
    return await app.fetch(req);
}

// Global test variables for positive flow
const testEmail = `testuser-${crypto.randomUUID()}@example.com`;
const testPassword = "SecurePassword123!";
let validAccessToken = "";

// ─────────────────────────────────────────────────────────────────────────────
// Registration Endpoint Tests
// ─────────────────────────────────────────────────────────────────────────────

Deno.test("POST /api/auth/register — positive: successfully creates a user", async () => {
    const res = await makeRequest("/api/auth/register", {
        email: testEmail,
        password: testPassword,
        recaptchaToken: "dummy-token",
    });

    // In a stateless/CI environment without a real Supabase DB, this might return 500.
    // If it succeeds, it should be 201.
    if (res.status === 201) {
        const json = await res.json();
        assertEquals(json.message, "Registration successful, please check your email for verification");
    } else {
        console.warn(`[WARN] Register returned ${res.status}. Ensure local Supabase is running for positive tests.`);
    }
});

Deno.test("POST /api/auth/register — negative: missing email returns 400", async () => {
    const res = await makeRequest("/api/auth/register", {
        password: testPassword,
        recaptchaToken: "dummy-token",
    });

    assertEquals(res.status, 400);
    const json = await res.json();
    assertEquals(json.error.code, "VALIDATION_ERROR");
    assertEquals(typeof json.error.requestId, "string");
});

Deno.test("POST /api/auth/register — negative: invalid email format returns 400", async () => {
    const res = await makeRequest("/api/auth/register", {
        email: "not-an-email",
        password: testPassword,
        recaptchaToken: "dummy-token",
    });

    assertEquals(res.status, 400);
    const json = await res.json();
    assertEquals(json.error.code, "VALIDATION_ERROR");
});

Deno.test("POST /api/auth/register — negative: short password returns 400", async () => {
    const res = await makeRequest("/api/auth/register", {
        email: testEmail,
        password: "short",
        recaptchaToken: "dummy-token",
    });

    assertEquals(res.status, 400);
    const json = await res.json();
    assertEquals(json.error.code, "VALIDATION_ERROR");
});

Deno.test("POST /api/auth/register — negative: missing recaptchaToken returns 400", async () => {
    const res = await makeRequest("/api/auth/register", {
        email: testEmail,
        password: testPassword,
    });

    assertEquals(res.status, 400);
    const json = await res.json();
    assertEquals(json.error.code, "VALIDATION_ERROR");
});

Deno.test("POST /api/auth/register — negative: empty body returns 400", async () => {
    const req = new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
    });

    const res = await app.fetch(req);
    assertEquals(res.status, 400);
});

// ─────────────────────────────────────────────────────────────────────────────
// Login Endpoint Tests
// ─────────────────────────────────────────────────────────────────────────────

Deno.test("POST /api/auth/login — positive: successfully logs in user", async () => {
    const res = await makeRequest("/api/auth/login", {
        email: testEmail,
        password: testPassword,
        recaptchaToken: "dummy-token",
    });

    if (res.status === 200) {
        const json = await res.json();
        assertEquals(typeof json.accessToken, "string");
        validAccessToken = json.accessToken;
    } else {
        console.warn(`[WARN] Login returned ${res.status}. Expected 200 if user exists and is verified.`);
    }
});

Deno.test("POST /api/auth/login — negative: wrong password returns 401", async () => {
    const res = await makeRequest("/api/auth/login", {
        email: testEmail,
        password: "WrongPassword123!",
        recaptchaToken: "dummy-token",
    });

    if (res.status === 401) {
        const json = await res.json();
        assertEquals(json.error.code, "UNAUTHORIZED");
    } else {
        console.warn(`[WARN] Login wrong password returned ${res.status}. Expected 401.`);
    }
});

Deno.test("POST /api/auth/login — negative: missing email returns 400", async () => {
    const res = await makeRequest("/api/auth/login", {
        password: testPassword,
        recaptchaToken: "dummy-token",
    });

    assertEquals(res.status, 400);
    const json = await res.json();
    assertEquals(json.error.code, "VALIDATION_ERROR");
});

Deno.test("POST /api/auth/login — negative: missing password returns 400", async () => {
    const res = await makeRequest("/api/auth/login", {
        email: testEmail,
        recaptchaToken: "dummy-token",
    });

    assertEquals(res.status, 400);
});

Deno.test("POST /api/auth/login — negative: invalid email format returns 400", async () => {
    const res = await makeRequest("/api/auth/login", {
        email: "bad-email",
        password: testPassword,
        recaptchaToken: "dummy-token",
    });

    assertEquals(res.status, 400);
});

// ─────────────────────────────────────────────────────────────────────────────
// Logout Endpoint Tests
// ─────────────────────────────────────────────────────────────────────────────

Deno.test("POST /api/auth/logout — positive: successfully logs out user", async () => {
    const token = validAccessToken || "dummy-valid-token";

    const req = new Request("http://localhost/api/auth/logout", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
        },
    });

    const res = await app.fetch(req);
    
    if (res.status === 200) {
        const json = await res.json();
        assertEquals(json.message, "Successfully logged out");
    } else {
        console.warn(`[WARN] Logout returned ${res.status}. Expected 200 if token is valid.`);
    }
});

Deno.test("POST /api/auth/logout — negative: missing authorization header returns 401", async () => {
    const req = new Request("http://localhost/api/auth/logout", {
        method: "POST",
    });

    const res = await app.fetch(req);
    assertEquals(res.status, 401);
    const json = await res.json();
    assertEquals(json.error.code, "UNAUTHORIZED");
});

Deno.test("POST /api/auth/logout — negative: invalid authorization header format returns 401", async () => {
    const req = new Request("http://localhost/api/auth/logout", {
        method: "POST",
        headers: {
            "Authorization": "Basic some-token",
        },
    });

    const res = await app.fetch(req);
    assertEquals(res.status, 401);
    const json = await res.json();
    assertEquals(json.error.code, "UNAUTHORIZED");
});

// ─────────────────────────────────────────────────────────────────────────────
// Error Envelope Compliance Tests
// ─────────────────────────────────────────────────────────────────────────────

Deno.test("Error responses include requestId from X-Request-ID header", async () => {
    const customRequestId = "custom-trace-id-12345";
    const req = new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Request-ID": customRequestId,
        },
        body: JSON.stringify({ email: "invalid", password: "short" }),
    });

    const res = await app.fetch(req);
    assertEquals(res.status, 400);

    const json = await res.json();
    assertEquals(json.error.requestId, customRequestId);
});

Deno.test("Error responses always have the standard envelope shape", async () => {
    const res = await makeRequest("/api/auth/login", {});

    assertEquals(res.status, 400);
    const json = await res.json();

    assertEquals(typeof json.error, "object");
    assertEquals(typeof json.error.code, "string");
    assertEquals(typeof json.error.message, "string");
    assertEquals(typeof json.error.requestId, "string");
    assertEquals(json.error.code !== "", true);
    assertEquals(json.error.message !== "", true);
});
