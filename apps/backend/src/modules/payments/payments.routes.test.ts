import { assertEquals } from "jsr:@std/assert";
import { describe, it, beforeAll, afterAll } from "jsr:@std/testing/bdd";
import { stub, type Stub } from "jsr:@std/testing/mock";
import app from "../../main.ts";
import { stripe } from "../../config/stripe.ts";
import { resend } from "../../config/resend.ts";
import { db } from "../../config/drizzle.ts";
import { paymentTransactions } from "../../shared/models/db.model.ts";
import { eq } from "drizzle-orm";
import { getSupabaseAdmin, getSupabaseAnon } from "../../config/supabase.ts";
import { users } from "../../shared/models/db.model.ts";

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
    let testEmail = "";
    let tenantIdForTest = "";
    let validAccessToken = "";
    let checkoutStub: Stub<any>;
    let webhookEventOverride: any = null;
    let portalStub: Stub<any>;
    let webhookEventStub: Stub<any>;
    let verifyStub: Stub<any>;

    beforeAll(async () => {
        testEmail = `payment-route-${crypto.randomUUID()}@example.com`;
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
        const authClient = getSupabaseAnon();
        const { data: authData, error: signInError } = await authClient.auth.signInWithPassword({
            email: testEmail,
            password: testPassword,
        });

        if (signInError || !authData?.session) {
            console.warn(`[WARN] Login for test user failed: ${signInError?.message}`);
        } else {
            validAccessToken = authData.session.access_token;
        }

        // Resolve the tenantId bound to the test user's JWT (auth middleware reads users.tenantId).
        const [userRow] = await db
            .select({ tenantId: users.tenantId })
            .from(users)
            .where(eq(users.email, testEmail));
        tenantIdForTest = userRow?.tenantId ?? "";

        // Mock Stripe API calls
        checkoutStub = stub(stripe.checkout.sessions, "create", () => {
            return Promise.resolve({
                id: "cs_test_route_123",
                url: "https://checkout.stripe.com/test",
                amount_total: 1000,
                currency: "usd",
            } as any);
        });

        verifyStub = stub(stripe.checkout.sessions, "retrieve", (sessionId: string) => {
            if (sessionId === "cs_test_unknown") {
                return Promise.reject(new Error("No such checkout session"));
            }
            if (sessionId === "cs_test_foreign") {
                return Promise.resolve({
                    id: sessionId,
                    metadata: { tenantId: "foreign-tenant-id", tierToUnlock: "PRO" },
                    payment_status: "paid",
                } as any);
            }
            return Promise.resolve({
                id: sessionId,
                metadata: { tenantId: tenantIdForTest, tierToUnlock: "SIMULATE" },
                payment_status: "paid",
            } as any);
        });

        portalStub = stub(stripe.billingPortal.sessions, "create", () => {
            return Promise.resolve({
                url: "https://billing.stripe.com/test",
            } as any);
        });

        webhookEventStub = stub(stripe.webhooks, "constructEventAsync", (body, signature, secret) => {
            if (signature === "invalid") return Promise.reject(new Error("Invalid signature"));

            // Nested describes may override the parsed event (e.g. the email
            // flow test seeds a full checkout.session.completed object).
            if (webhookEventOverride !== null) {
                return Promise.resolve(webhookEventOverride);
            }

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
        verifyStub.restore();
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

    describe("POST /api/payments/checkout/verify", () => {
        it("negative: missing authorization returns 401", async () => {
            const res = await makeRequest(
                "/api/payments/checkout/verify",
                "POST",
                { sessionId: "cs_test_anything" },
                {}
            );

            assertEquals(res.status, 401);
        });

        it("negative: invalid or missing sessionId returns 400", async () => {
            const headers = { Authorization: `Bearer ${validAccessToken}` };

            const missingRes = await makeRequest("/api/payments/checkout/verify", "POST", {}, headers);
            assertEquals(missingRes.status, 400);
            assertEquals((await missingRes.json()).error.code, "VALIDATION_ERROR");

            const malformedRes = await makeRequest(
                "/api/payments/checkout/verify",
                "POST",
                { sessionId: "not-a-stripe-session" },
                headers,
            );
            assertEquals(malformedRes.status, 400);
            assertEquals((await malformedRes.json()).error.code, "VALIDATION_ERROR");
        });

        it("negative: unknown session returns 404", async () => {
            const headers = { Authorization: `Bearer ${validAccessToken}` };
            const res = await makeRequest(
                "/api/payments/checkout/verify",
                "POST",
                { sessionId: "cs_test_unknown" },
                headers,
            );

            assertEquals(res.status, 404);
            assertEquals((await res.json()).error.code, "NOT_FOUND");
        });

        it("negative: session owned by another tenant returns 404", async () => {
            const headers = { Authorization: `Bearer ${validAccessToken}` };
            const res = await makeRequest(
                "/api/payments/checkout/verify",
                "POST",
                { sessionId: "cs_test_foreign" },
                headers,
            );

            assertEquals(res.status, 404);
            assertEquals((await res.json()).error.code, "NOT_FOUND");
        });

        it("positive: session owned by the tenant returns paid status and tier", async () => {
            const headers = { Authorization: `Bearer ${validAccessToken}` };
            const res = await makeRequest(
                "/api/payments/checkout/verify",
                "POST",
                { sessionId: "cs_test_owned" },
                headers,
            );

            assertEquals(res.status, 200);
            const json = await res.json();
            assertEquals(json.valid, true);
            assertEquals(json.status, "paid");
            assertEquals(json.tier, "SIMULATE");
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
            assertEquals(json.received, true);
        });
    });

    describe("webhook triggers payment success email", () => {
        let originalEmailSend: any;
        let lastEmailPayload: any;
        const externalId = `email-test-${crypto.randomUUID()}`;

        beforeAll(async () => {
            // Seed a pending transaction for the test tenant.
            await db.insert(paymentTransactions).values({
                tenantId: tenantIdForTest,
                externalId,
                stripeSessionId: "cs_test_email_flow",
                tierToUnlock: "PRO",
                amount: 58000,
                currency: "IDR",
                status: "PENDING",
            });

            // Mock Resend so no real email leaves the test environment.
            // Direct assignment (not stub()): resend.emails.send is an instance
            // method that stub() refuses to wrap.
            originalEmailSend = resend.emails.send;
            // @ts-ignore - Bypass strict Resend types for mocking
            resend.emails.send = async (payload: any) => {
                lastEmailPayload = payload;
                return { data: { id: "test-id" }, error: null };
            };

            // Point the webhook signature verifier at a completed session owned by the tenant.
            webhookEventOverride = {
                type: "checkout.session.completed",
                data: {
                    object: {
                        id: "cs_test_email_flow",
                        amount_total: 58000,
                        currency: "idr",
                        customer: `cus_test_email_${Date.now()}`,
                        metadata: {
                            tenantId: tenantIdForTest,
                            externalId,
                            tierToUnlock: "PRO",
                        },
                    },
                },
            };
        });

        afterAll(async () => {
            webhookEventOverride = null;
            resend.emails.send = originalEmailSend;
            await db.delete(paymentTransactions).where(eq(paymentTransactions.externalId, externalId));
        });

        it("positive: sends a summary email to the tenant's user with the right payload", async () => {
            const req = new Request("http://localhost/api/payments/webhook", {
                method: "POST",
                headers: {
                    "stripe-signature": "valid-signature"
                },
                body: "raw body data",
            });

            const res = await app.fetch(req);
            assertEquals(res.status, 200);

            assertEquals(typeof lastEmailPayload, "object");
            assertEquals(lastEmailPayload.from, "Dokyudo <team@dokyudo.my.id>");
            assertEquals(lastEmailPayload.subject.includes("Pro Real"), true);
            const html = lastEmailPayload.html.replace(/\u00A0/g, " ");
            assertEquals(html.includes("Rp 58.000,00"), true);
            assertEquals(html.includes("Open Dokyudo"), true);
        });
    });
});
