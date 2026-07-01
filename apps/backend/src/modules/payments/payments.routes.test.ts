import { assertEquals } from "jsr:@std/assert";
import { describe, it, beforeAll, afterAll } from "jsr:@std/testing/bdd";
import { stub, type Stub } from "jsr:@std/testing/mock";
import app from "../../main.ts";
import { stripe } from "../../config/stripe.ts";
import { db } from "../../config/drizzle.ts";
import { paymentTransactions } from "../../shared/models/db.model.ts";
import { eq } from "drizzle-orm";
import { getSupabaseAdmin } from "../../config/supabase.ts";

/** Helper: make a request to the test app */
async function makeRequest(
    path: string,
    method: "GET" | "POST" | "PUT" | "DELETE",
    body?: Record<string, unknown> | null,
    headers: Record<string, string> = {},
): Promise<Response> {
    const randomIp = `127.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    
    const reqHeaders: Record<string, string> = {
        "X-Request-ID": `test-req-${crypto.randomUUID()}`,
        "X-Forwarded-For": randomIp,
        ...headers,
    };

    if (body) {
        reqHeaders["Content-Type"] = "application/json";
    }

    const req = new Request(`http://localhost${path}`, {
        method,
        headers: reqHeaders,
        body: body ? JSON.stringify(body) : undefined,
    });
    return await app.fetch(req);
}

describe("Payments Routes", () => {
    let validAccessToken = "";
    let checkoutStub: Stub<any>;
    let portalStub: Stub<any>;
    let webhookEventStub: Stub<any>;

    beforeAll(async () => {
        const testEmail = `payment-route-${crypto.randomUUID()}@example.com`;
        const testPassword = "SecurePassword123!";

        // 1. Create a confirmed user in Supabase
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase.auth.admin.createUser({
            email: testEmail,
            password: testPassword,
            email_confirm: true,
        });

        if (error || !data.user) {
            throw new Error("Failed to create test user for route tests: " + error?.message);
        }

        // Wait a small moment to ensure the database trigger creates the user record
        await new Promise((resolve) => setTimeout(resolve, 500));

        // 2. Login to get the JWT
        const loginRes = await makeRequest("/api/auth/login", "POST", {
            email: testEmail,
            password: testPassword,
            recaptchaToken: "bypass",
        });

        if (loginRes.status === 200) {
            const json = await loginRes.json();
            validAccessToken = json.accessToken;
        } else {
            console.warn(`[WARN] Login for test user failed with status ${loginRes.status}`);
        }

        // Mock Stripe API calls
        checkoutStub = stub(stripe.checkout.sessions, "create", () => {
            return Promise.resolve({
                id: "cs_test_route_123",
                url: "https://checkout.stripe.com/test",
                amount_total: 1000,
                currency: "usd",
            } as any);
        });

        portalStub = stub(stripe.billingPortal.sessions, "create", () => {
            return Promise.resolve({
                url: "https://billing.stripe.com/test",
            } as any);
        });

        webhookEventStub = stub(stripe.webhooks, "constructEventAsync", (body, signature, secret) => {
            if (signature === "invalid") return Promise.reject(new Error("Invalid signature"));
            
            // Mock a parsed Stripe Event
            return Promise.resolve({
                type: "checkout.session.completed",
                data: {
                    object: {
                        client_reference_id: "unknown_in_route_test", 
                    }
                }
            } as any);
        });
    });

    afterAll(() => {
        checkoutStub.restore();
        portalStub.restore();
        webhookEventStub.restore();
    });

    describe("POST /api/payments/checkout", () => {
        it("positive: returns 201 with checkout url", async () => {
            const res = await makeRequest(
                "/api/payments/checkout",
                "POST",
                { tierToUnlock: "PRO" },
                { Authorization: `Bearer ${validAccessToken}` }
            );

            assertEquals(res.status, 201);
            const json = await res.json();
            assertEquals(typeof json.checkoutUrl, "string");
            assertEquals(json.sessionId, "cs_test_route_123");
        });

        it("negative: invalid tier returns 400 validation error", async () => {
            const res = await makeRequest(
                "/api/payments/checkout",
                "POST",
                { tierToUnlock: "INVALID_TIER" },
                { Authorization: `Bearer ${validAccessToken}` }
            );

            assertEquals(res.status, 400);
            const json = await res.json();
            assertEquals(json.error.code, "VALIDATION_ERROR");
        });

        it("negative: missing authorization returns 401", async () => {
            const res = await makeRequest(
                "/api/payments/checkout",
                "POST",
                { tierToUnlock: "PRO" },
                {}
            );

            assertEquals(res.status, 401);
        });
    });

    describe("POST /api/payments/portal", () => {
        it("negative: rejects if tenant has no active stripe customer", async () => {
            const res = await makeRequest(
                "/api/payments/portal",
                "POST",
                null,
                { Authorization: `Bearer ${validAccessToken}` }
            );

            assertEquals(res.status, 400);
            const json = await res.json();
            // Expected because we didn't mock a DB subscription with stripeCustomerId for this tenant
            assertEquals(json.error.code, "VALIDATION_ERROR"); 
        });

        it("negative: missing authorization returns 401", async () => {
            const res = await makeRequest(
                "/api/payments/portal",
                "POST",
                null,
                {}
            );

            assertEquals(res.status, 401);
        });
    });

    describe("POST /api/payments/webhook", () => {
        it("negative: missing stripe-signature returns 401", async () => {
            const req = new Request("http://localhost/api/payments/webhook", {
                method: "POST",
                body: "raw body data",
            });

            const res = await app.fetch(req);
            assertEquals(res.status, 401);
            const json = await res.json();
            assertEquals(json.error.code, "UNAUTHORIZED");
        });

        it("negative: invalid signature returns 401", async () => {
            const req = new Request("http://localhost/api/payments/webhook", {
                method: "POST",
                headers: {
                    "stripe-signature": "invalid"
                },
                body: "raw body data",
            });

            const res = await app.fetch(req);
            assertEquals(res.status, 401);
            const json = await res.json();
            assertEquals(json.error.code, "UNAUTHORIZED");
        });

        it("positive: valid signature processes webhook", async () => {
            const req = new Request("http://localhost/api/payments/webhook", {
                method: "POST",
                headers: {
                    "stripe-signature": "valid-signature"
                },
                body: "raw body data",
            });

            const res = await app.fetch(req);
            assertEquals(res.status, 200);
            const json = await res.json();
            assertEquals(json.acknowledged, true);
            assertEquals(json.reason, "unknown_transaction");
        });
    });
});
