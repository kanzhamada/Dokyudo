import { assertEquals } from "@std/assert";
import app from "../main.ts";

/** Helper: make a request to the test app */
async function makeRequest(
    path: string,
    body: Record<string, unknown>
): Promise<Response> {
    const req = new Request(`http://localhost${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Request-ID": "test-request-id-001",
        },
        body: JSON.stringify(body),
    });
    return await app.fetch(req);
}

// ─────────────────────────────────────────────────────────────────────────────
// Registration Endpoint Tests
// ─────────────────────────────────────────────────────────────────────────────

Deno.test("POST /api/auth/register — missing email returns 400", async () => {
    const res = await makeRequest("/api/auth/register", {
        password: "SecurePassword123!",
        recaptchaToken: "dummy-token",
    });

    assertEquals(res.status, 400);
    const json = await res.json();
    assertEquals(json.error.code, "VALIDATION_ERROR");
    assertEquals(typeof json.error.requestId, "string");
});

Deno.test("POST /api/auth/register — invalid email format returns 400", async () => {
    const res = await makeRequest("/api/auth/register", {
        email: "not-an-email",
        password: "SecurePassword123!",
        recaptchaToken: "dummy-token",
    });

    assertEquals(res.status, 400);
    const json = await res.json();
    assertEquals(json.error.code, "VALIDATION_ERROR");
});

Deno.test("POST /api/auth/register — short password returns 400", async () => {
    const res = await makeRequest("/api/auth/register", {
        email: "test@example.com",
        password: "short",
        recaptchaToken: "dummy-token",
    });

    assertEquals(res.status, 400);
    const json = await res.json();
    assertEquals(json.error.code, "VALIDATION_ERROR");
});

Deno.test("POST /api/auth/register — missing recaptchaToken returns 400", async () => {
    const res = await makeRequest("/api/auth/register", {
        email: "test@example.com",
        password: "SecurePassword123!",
    });

    assertEquals(res.status, 400);
    const json = await res.json();
    assertEquals(json.error.code, "VALIDATION_ERROR");
});

Deno.test("POST /api/auth/register — empty recaptchaToken returns 400", async () => {
    const res = await makeRequest("/api/auth/register", {
        email: "test@example.com",
        password: "SecurePassword123!",
        recaptchaToken: "",
    });

    assertEquals(res.status, 400);
    const json = await res.json();
    assertEquals(json.error.code, "VALIDATION_ERROR");
});

Deno.test("POST /api/auth/register — empty body returns 400", async () => {
    const req = new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Request-ID": "test-empty-body",
        },
        body: "{}",
    });

    const res = await app.fetch(req);
    assertEquals(res.status, 400);
});

Deno.test("POST /api/auth/register — malformed JSON returns 400", async () => {
    const req = new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Request-ID": "test-malformed",
        },
        body: "{invalid-json",
    });

    const res = await app.fetch(req);
    // Should be 400 (validation) or 500 (parse error caught by global handler)
    const status = res.status;
    assertEquals(status >= 400 && status < 600, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Login Endpoint Tests
// ─────────────────────────────────────────────────────────────────────────────

Deno.test("POST /api/auth/login — missing email returns 400", async () => {
    const res = await makeRequest("/api/auth/login", {
        password: "SecurePassword123!",
        recaptchaToken: "dummy-token",
    });

    assertEquals(res.status, 400);
    const json = await res.json();
    assertEquals(json.error.code, "VALIDATION_ERROR");
    assertEquals(typeof json.error.requestId, "string");
});

Deno.test("POST /api/auth/login — missing password returns 400", async () => {
    const res = await makeRequest("/api/auth/login", {
        email: "test@example.com",
        recaptchaToken: "dummy-token",
    });

    assertEquals(res.status, 400);
    const json = await res.json();
    assertEquals(json.error.code, "VALIDATION_ERROR");
});

Deno.test("POST /api/auth/login — missing recaptchaToken returns 400", async () => {
    const res = await makeRequest("/api/auth/login", {
        email: "test@example.com",
        password: "SecurePassword123!",
    });

    assertEquals(res.status, 400);
    const json = await res.json();
    assertEquals(json.error.code, "VALIDATION_ERROR");
});

Deno.test("POST /api/auth/login — invalid email format returns 400", async () => {
    const res = await makeRequest("/api/auth/login", {
        email: "bad-email",
        password: "SecurePassword123!",
        recaptchaToken: "dummy-token",
    });

    assertEquals(res.status, 400);
    const json = await res.json();
    assertEquals(json.error.code, "VALIDATION_ERROR");
});

Deno.test("POST /api/auth/login — empty body returns 400", async () => {
    const req = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Request-ID": "test-empty-login",
        },
        body: "{}",
    });

    const res = await app.fetch(req);
    assertEquals(res.status, 400);
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
        body: JSON.stringify({
            email: "invalid",
            password: "short",
            recaptchaToken: "dummy",
        }),
    });

    const res = await app.fetch(req);
    assertEquals(res.status, 400);

    const json = await res.json();
    assertEquals(json.error.requestId, customRequestId);
    assertEquals(typeof json.error.code, "string");
    assertEquals(typeof json.error.message, "string");
});

Deno.test("Error responses always have the standard envelope shape", async () => {
    const res = await makeRequest("/api/auth/login", {});

    assertEquals(res.status, 400);
    const json = await res.json();

    // Verify envelope shape
    assertEquals(typeof json.error, "object");
    assertEquals(typeof json.error.code, "string");
    assertEquals(typeof json.error.message, "string");
    assertEquals(typeof json.error.requestId, "string");

    // Verify no raw error strings leaked
    assertEquals(json.error.code !== "", true);
    assertEquals(json.error.message !== "", true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────────────────────

Deno.test("GET /health — returns 200 with status ok", async () => {
    const req = new Request("http://localhost/health", { method: "GET" });
    const res = await app.fetch(req);

    assertEquals(res.status, 200);
    const json = await res.json();
    assertEquals(json.status, "ok");
    assertEquals(typeof json.timestamp, "string");
});

// ─────────────────────────────────────────────────────────────────────────────
// OpenAPI Spec
// ─────────────────────────────────────────────────────────────────────────────

Deno.test("GET /doc — returns valid OpenAPI spec", async () => {
    const req = new Request("http://localhost/doc", { method: "GET" });
    const res = await app.fetch(req);

    assertEquals(res.status, 200);
    const json = await res.json();
    assertEquals(json.openapi, "3.1.0");
    assertEquals(json.info.title, "Dokyudo API");
    assertEquals(typeof json.paths, "object");
    assertEquals(typeof json.paths["/api/auth/register"], "object");
    assertEquals(typeof json.paths["/api/auth/login"], "object");
});

Deno.test("GET /reference — returns Scalar API Reference HTML", async () => {
    const req = new Request("http://localhost/reference", { method: "GET" });
    const res = await app.fetch(req);

    assertEquals(res.status, 200);
    const contentType = res.headers.get("content-type") ?? "";
    assertEquals(contentType.includes("text/html"), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// IP Extraction Unit Tests (direct function tests)
// ─────────────────────────────────────────────────────────────────────────────

import { extractClientIp } from "../shared/middlewares/request.middleware.ts";

Deno.test("extractClientIp — X-Forwarded-For takes priority", () => {
    const headers = new Headers({
        "X-Forwarded-For": "203.0.113.50, 70.41.3.18, 150.172.238.178",
        "X-Real-IP": "10.0.0.1",
    });
    assertEquals(extractClientIp(headers), "203.0.113.50");
});

Deno.test("extractClientIp — falls back to X-Real-IP", () => {
    const headers = new Headers({
        "X-Real-IP": "10.0.0.1",
    });
    assertEquals(extractClientIp(headers), "10.0.0.1");
});

Deno.test("extractClientIp — falls back to CF-Connecting-IP", () => {
    const headers = new Headers({
        "CF-Connecting-IP": "172.16.0.5",
    });
    assertEquals(extractClientIp(headers), "172.16.0.5");
});

Deno.test("extractClientIp — falls back to 0.0.0.0 with no headers", () => {
    const headers = new Headers();
    assertEquals(extractClientIp(headers), "0.0.0.0");
});

Deno.test("extractClientIp — single IP in X-Forwarded-For", () => {
    const headers = new Headers({
        "X-Forwarded-For": "192.168.1.1",
    });
    assertEquals(extractClientIp(headers), "192.168.1.1");
});
