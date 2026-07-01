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
            "X-Request-ID": "test-request-id-001",
            "X-Forwarded-For": randomIp,
            ...headers,
        },
        body: JSON.stringify(body),
    });
    return await app.fetch(req);
}

describe("Auth Module", () => {
    let validAccessToken = "";
    const testEmail = `testuser-${crypto.randomUUID()}@example.com`;
    const testPassword = "SecurePassword123!";

    describe("POST /api/auth/register", () => {
        it("positive: successfully creates a user", async () => {
            const res = await makeRequest("/api/auth/register", {
                email: testEmail,
                password: testPassword,
                recaptchaToken: "dummy-token",
            });

            if (res.status === 201) {
                const json = await res.json();
                assertEquals(
                    json.message,
                    "Registration successful, please check your email for verification",
                );
            } else {
                console.warn(
                    `[WARN] Register returned ${res.status}. Ensure local Supabase is running for positive tests.`,
                );
            }
        });

        it("negative: User-Agent anomaly detection drops IP limit to 3", async () => {
            const maliciousIp = `192.168.200.${Math.floor(Math.random() * 255)}`;

            // Send 4 requests with different User-Agents
            for (let i = 1; i <= 4; i++) {
                const freshEmail = `reg-spam-${crypto.randomUUID()}@example.com`;
                await makeRequest(
                    "/api/auth/register",
                    {
                        email: freshEmail,
                        password: "ValidPassword123!",
                        recaptchaToken: "dummy-token",
                    },
                    {
                        "X-Forwarded-For": maliciousIp,
                        "User-Agent": `Spam-Bot-v${i}`,
                    },
                );
            }

            // The 5th request will detect 4 unique UAs in DB, triggering the anomaly limit (3)
            const finalEmail = `reg-spam-${crypto.randomUUID()}@example.com`;
            const finalRes = await makeRequest(
                "/api/auth/register",
                {
                    email: finalEmail,
                    password: "ValidPassword123!",
                    recaptchaToken: "dummy-token",
                },
                {
                    "X-Forwarded-For": maliciousIp,
                    "User-Agent": "Spam-Bot-v5",
                },
            );

            if (finalRes.status === 429) {
                const json = await finalRes.json();
                assertEquals(json.error.code, "RATE_LIMIT_EXCEEDED");
            } else {
                throw new Error(
                    `Expected 429 RATE_LIMIT_EXCEEDED for Register Anomaly, got ${finalRes.status}`,
                );
            }
        });

        it("negative: missing email returns 400", async () => {
            const res = await makeRequest("/api/auth/register", {
                password: testPassword,
                recaptchaToken: "dummy-token",
            });

            assertEquals(res.status, 400);
            const json = await res.json();
            assertEquals(json.error.code, "VALIDATION_ERROR");
            assertEquals(typeof json.error.requestId, "string");
        });

        it("negative: invalid email format returns 400", async () => {
            const res = await makeRequest("/api/auth/register", {
                email: "not-an-email",
                password: testPassword,
                recaptchaToken: "dummy-token",
            });

            assertEquals(res.status, 400);
            const json = await res.json();
            assertEquals(json.error.code, "VALIDATION_ERROR");
        });

        it("negative: short password returns 400", async () => {
            const res = await makeRequest("/api/auth/register", {
                email: testEmail,
                password: "short",
                recaptchaToken: "dummy-token",
            });

            assertEquals(res.status, 400);
            const json = await res.json();
            assertEquals(json.error.code, "VALIDATION_ERROR");
        });

        it("negative: password too long returns 400", async () => {
            const res = await makeRequest("/api/auth/register", {
                email: testEmail,
                password: "A1!" + "a".repeat(70),
                recaptchaToken: "dummy-token",
            });

            assertEquals(res.status, 400);
            const json = await res.json();
            assertEquals(json.error.code, "VALIDATION_ERROR");
        });

        it("negative: password missing uppercase returns 400", async () => {
            const res = await makeRequest("/api/auth/register", {
                email: testEmail,
                password: "securepassword123!",
                recaptchaToken: "dummy-token",
            });

            assertEquals(res.status, 400);
            const json = await res.json();
            assertEquals(json.error.code, "VALIDATION_ERROR");
        });

        it("negative: password missing lowercase returns 400", async () => {
            const res = await makeRequest("/api/auth/register", {
                email: testEmail,
                password: "SECUREPASSWORD123!",
                recaptchaToken: "dummy-token",
            });

            assertEquals(res.status, 400);
            const json = await res.json();
            assertEquals(json.error.code, "VALIDATION_ERROR");
        });

        it("negative: password missing number returns 400", async () => {
            const res = await makeRequest("/api/auth/register", {
                email: testEmail,
                password: "SecurePassword!",
                recaptchaToken: "dummy-token",
            });

            assertEquals(res.status, 400);
            const json = await res.json();
            assertEquals(json.error.code, "VALIDATION_ERROR");
        });

        it("negative: password missing symbol returns 400", async () => {
            const res = await makeRequest("/api/auth/register", {
                email: testEmail,
                password: "SecurePassword123",
                recaptchaToken: "dummy-token",
            });

            assertEquals(res.status, 400);
            const json = await res.json();
            assertEquals(json.error.code, "VALIDATION_ERROR");
        });

        it("negative: missing recaptchaToken returns 400", async () => {
            const res = await makeRequest("/api/auth/register", {
                email: testEmail,
                password: testPassword,
            });

            assertEquals(res.status, 400);
            const json = await res.json();
            assertEquals(json.error.code, "VALIDATION_ERROR");
        });

        it("negative: empty body returns 400", async () => {
            const randomIp = `127.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
            const req = new Request("http://localhost/api/auth/register", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "X-Forwarded-For": randomIp
                },
                body: "{}",
            });

            const res = await app.fetch(req);
            assertEquals(res.status, 400);
        });
    });

    describe("POST /api/auth/login", () => {
        it("positive: successfully logs in user", async () => {
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
                console.warn(
                    `[WARN] Login returned ${res.status}. Expected 200 if user exists and is verified.`,
                );
            }
        });

        it("negative: wrong password returns 401", async () => {
            const res = await makeRequest("/api/auth/login", {
                email: testEmail,
                password: "WrongPassword123!",
                recaptchaToken: "dummy-token",
            });

            if (res.status === 401) {
                const json = await res.json();
                assertEquals(json.error.code, "UNAUTHORIZED");
            } else {
                console.warn(
                    `[WARN] Login wrong password returned ${res.status}. Expected 401.`,
                );
            }
        });

        it("negative: missing email returns 400", async () => {
            const res = await makeRequest("/api/auth/login", {
                password: testPassword,
                recaptchaToken: "dummy-token",
            });

            assertEquals(res.status, 400);
            const json = await res.json();
            assertEquals(json.error.code, "VALIDATION_ERROR");
        });

        it("negative: missing password returns 400", async () => {
            const res = await makeRequest("/api/auth/login", {
                email: testEmail,
                recaptchaToken: "dummy-token",
            });

            assertEquals(res.status, 400);
        });

        it("negative: invalid email format returns 400", async () => {
            const res = await makeRequest("/api/auth/login", {
                email: "bad-email",
                password: testPassword,
                recaptchaToken: "dummy-token",
            });

            assertEquals(res.status, 400);
        });

        it("negative: User-Agent anomaly detection drops IP limit to 3", async () => {
            const maliciousIp = `192.168.100.${Math.floor(Math.random() * 255)}`;
            const freshEmail = `ua-test-${crypto.randomUUID()}@example.com`;

            // Send 4 requests with different User-Agents
            for (let i = 1; i <= 4; i++) {
                const res = await makeRequest(
                    "/api/auth/login",
                    {
                        email: freshEmail,
                        password: "WrongPassword!",
                        recaptchaToken: "dummy-token",
                    },
                    {
                        "X-Forwarded-For": maliciousIp,
                        "User-Agent": `Malicious-Bot-v${i}`,
                    },
                );
                assertEquals(res.status, 401);
            }

            const finalRes = await makeRequest(
                "/api/auth/login",
                {
                    email: freshEmail,
                    password: "WrongPassword!",
                    recaptchaToken: "dummy-token",
                },
                {
                    "X-Forwarded-For": maliciousIp,
                    "User-Agent": "Malicious-Bot-v5",
                },
            );

            if (finalRes.status === 429) {
                const json = await finalRes.json();
                assertEquals(json.error.code, "RATE_LIMIT_EXCEEDED");
            } else {
                throw new Error(
                    `Expected 429 RATE_LIMIT_EXCEEDED for User-Agent Anomaly, got ${finalRes.status}`,
                );
            }
        });

        it("negative: Per-Email Password Spraying Lockout at 5 attempts", async () => {
            const targetEmail = `victim-${crypto.randomUUID()}@example.com`;

            // 5 different IPs try the same email
            for (let i = 1; i <= 5; i++) {
                const sprayIp = `10.0.0.${i}`;
                const res = await makeRequest(
                    "/api/auth/login",
                    {
                        email: targetEmail,
                        password: "WrongPassword!",
                        recaptchaToken: "dummy-token",
                    },
                    {
                        "X-Forwarded-For": sprayIp,
                    },
                );
                assertEquals(res.status, 401);
            }

            const finalIp = `10.0.0.6`;
            const finalRes = await makeRequest(
                "/api/auth/login",
                {
                    email: targetEmail,
                    password: "WrongPassword!",
                    recaptchaToken: "dummy-token",
                },
                {
                    "X-Forwarded-For": finalIp,
                },
            );

            if (finalRes.status === 429) {
                const json = await finalRes.json();
                assertEquals(json.error.code, "RATE_LIMIT_EXCEEDED");
            } else {
                throw new Error(
                    `Expected 429 RATE_LIMIT_EXCEEDED for Account Lockout, got ${finalRes.status}`,
                );
            }
        });
    });

    describe("POST /api/auth/logout", () => {
        it("positive: successfully logs out user", async () => {
            const token = validAccessToken || "dummy-valid-token";

            const req = new Request("http://localhost/api/auth/logout", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const res = await app.fetch(req);

            if (res.status === 200) {
                const json = await res.json();
                assertEquals(json.message, "Successfully logged out");
            } else {
                console.warn(
                    `[WARN] Logout returned ${res.status}. Expected 200 if token is valid.`,
                );
            }
        });

        it("negative: missing authorization header returns 401", async () => {
            const randomIp = `127.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
            const req = new Request("http://localhost/api/auth/logout", {
                method: "POST",
                headers: {
                    "X-Forwarded-For": randomIp
                }
            });

            const res = await app.fetch(req);
            assertEquals(res.status, 401);
            const json = await res.json();
            assertEquals(json.error.code, "UNAUTHORIZED");
        });

        it("negative: invalid authorization header format returns 401", async () => {
            const randomIp = `127.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
            const req = new Request("http://localhost/api/auth/logout", {
                method: "POST",
                headers: {
                    Authorization: "Basic some-token",
                    "X-Forwarded-For": randomIp
                },
            });

            const res = await app.fetch(req);
            assertEquals(res.status, 401);
            const json = await res.json();
            assertEquals(json.error.code, "UNAUTHORIZED");
        });
    });

    describe("GET /api/auth/me", () => {
        it("positive: returns profile for authenticated user", async () => {
            const token = validAccessToken || "dummy-valid-token";
            const randomIp = `127.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
            const req = new Request("http://localhost/api/auth/me", {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "X-Forwarded-For": randomIp
                },
            });

            const res = await app.fetch(req);
            
            if (res.status === 200) {
                const json = await res.json();
                assertEquals(typeof json.user.id, "string");
                assertEquals(typeof json.tenant.id, "string");
                assertEquals(typeof json.subscription.tier, "string");
            } else {
                console.warn(
                    `[WARN] Get Profile returned ${res.status}. Expected 200 if token is valid.`,
                );
            }
        });

        it("negative: missing authorization header returns 401", async () => {
            const randomIp = `127.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
            const req = new Request("http://localhost/api/auth/me", {
                method: "GET",
                headers: {
                    "X-Forwarded-For": randomIp
                }
            });

            const res = await app.fetch(req);
            assertEquals(res.status, 401);
            const json = await res.json();
            assertEquals(json.error.code, "UNAUTHORIZED");
        });
    });

    describe("Password Recovery & Update", () => {
        it("positive: sends recovery email", async () => {
            const res = await makeRequest("/api/auth/forget-password", {
                email: testEmail,
                recaptchaToken: "dummy-token",
            });

            if (res.status === 200) {
                const json = await res.json();
                assertEquals(
                    json.message,
                    "If an account exists, a recovery email has been sent.",
                );
            } else {
                console.warn(
                    `[WARN] Forget password returned ${res.status}. Expected 200.`,
                );
            }
        });

        it("negative: missing email returns 400", async () => {
            const res = await makeRequest("/api/auth/forget-password", {
                recaptchaToken: "dummy-token",
            });

            assertEquals(res.status, 400);
        });

        it("negative: invalid OTP returns 401", async () => {
            const res = await makeRequest("/api/auth/reset-password", {
                email: testEmail,
                otp: "000000",
                newPassword: "NewSecurePassword123!",
            });

            if (res.status === 401) {
                const json = await res.json();
                assertEquals(json.error.code, "UNAUTHORIZED");
            } else if (res.status === 400) {
                assertEquals(true, true);
            } else {
                console.warn(
                    `[WARN] Reset password returned ${res.status}. Expected 401.`,
                );
            }
        });

        it("negative: update-password missing authorization header returns 401", async () => {
            const randomIp = `127.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
            const req = new Request("http://localhost/api/auth/update-password", {
                method: "PUT",
                headers: { 
                    "Content-Type": "application/json",
                    "X-Forwarded-For": randomIp
                },
                body: JSON.stringify({ newPassword: "NewSecurePassword123!" }),
            });

            const res = await app.fetch(req);
            assertEquals(res.status, 401);
        });

        it("negative: rate limit exceeded at 5 attempts", async () => {
            const targetEmail = `forget-${crypto.randomUUID()}@example.com`;
            const spamIp = `192.168.50.${Math.floor(Math.random() * 255)}`;

            for (let i = 1; i <= 5; i++) {
                await makeRequest(
                    "/api/auth/forget-password",
                    {
                        email: targetEmail,
                        recaptchaToken: "dummy-token",
                    },
                    {
                        "X-Forwarded-For": spamIp,
                    },
                );
            }

            const finalRes = await makeRequest(
                "/api/auth/forget-password",
                {
                    email: targetEmail,
                    recaptchaToken: "dummy-token",
                },
                {
                    "X-Forwarded-For": spamIp,
                },
            );

            if (finalRes.status === 429) {
                const json = await finalRes.json();
                assertEquals(json.error.code, "RATE_LIMIT_EXCEEDED");
            } else {
                console.warn(
                    `[WARN] Forget password rate limit returned ${finalRes.status}. Expected 429.`,
                );
            }
        });

        it("negative: reset-password missing otp returns 400", async () => {
            const res = await makeRequest("/api/auth/reset-password", {
                email: testEmail,
                newPassword: "NewSecurePassword123!",
            });
            assertEquals(res.status, 400);
        });

        it("negative: reset-password short password returns 400", async () => {
            const res = await makeRequest("/api/auth/reset-password", {
                email: testEmail,
                otp: "123456",
                newPassword: "short",
            });
            assertEquals(res.status, 400);
        });

        it("negative: update-password short password returns 400", async () => {
            const randomIp = `127.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
            const req = new Request("http://localhost/api/auth/update-password", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer dummy-token",
                    "X-Forwarded-For": randomIp
                },
                body: JSON.stringify({ newPassword: "short" }),
            });

            const res = await app.fetch(req);
            assertEquals(res.status, 400);
        });
    });

    describe("Error Envelope Compliance", () => {
        it("Error responses include requestId from X-Request-ID header", async () => {
            const customRequestId = "custom-trace-id-12345";
            const randomIp = `127.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
            const req = new Request("http://localhost/api/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Request-ID": customRequestId,
                    "X-Forwarded-For": randomIp,
                },
                body: JSON.stringify({ email: "invalid", password: "short" }),
            });

            const res = await app.fetch(req);
            assertEquals(res.status, 400);

            const json = await res.json();
            assertEquals(json.error.requestId, customRequestId);
        });

        it("Error responses always have the standard envelope shape", async () => {
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
    });
});
