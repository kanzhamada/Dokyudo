import { describe, it, beforeAll, afterAll } from "jsr:@std/testing/bdd";
import { assertEquals, assertRejects, assertExists } from "jsr:@std/assert";
import { stub, type Stub } from "jsr:@std/testing/mock";
import { PaymentsService } from "./payments.service.ts";
import { AppError } from "../../shared/utils/errors.util.ts";
import { db } from "../../config/drizzle.ts";
import {
    paymentTransactions,
    tenantSubscriptions,
    tenants,
    users,
} from "../../shared/models/db.model.ts";
import { eq } from "drizzle-orm";
import { stripe } from "../../config/stripe.ts";

describe("PaymentsService", () => {
    let testTenantId: string;
    let testUserId: string;

    beforeAll(async () => {
        testTenantId = crypto.randomUUID();
        testUserId = crypto.randomUUID();

        await db.insert(tenants).values({
            id: testTenantId,
            name: "Payment Test Tenant",
        });

        // Insert mock user (assuming auth doesn't strict check FK for isolated DB tests in some environments, 
        // if it does, we'll need to mock it via Supabase, but for payments, tenant is enough for most logic).
    });

    afterAll(async () => {
        await db.delete(paymentTransactions).where(eq(paymentTransactions.tenantId, testTenantId));
        await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, testTenantId));
        await db.delete(tenants).where(eq(tenants.id, testTenantId));
    });

    describe("createCheckoutSession", () => {
        let checkoutStub: Stub<any>;

        beforeAll(() => {
            // Mock stripe checkout creation
            checkoutStub = stub(stripe.checkout.sessions, "create", () => {
                return Promise.resolve({
                    id: "cs_test_123",
                    url: "https://checkout.stripe.com/test",
                    amount_total: 1000,
                    currency: "usd",
                } as any);
            });
        });

        afterAll(() => {
            checkoutStub.restore();
        });

        it("positive: creates checkout session and stores transaction", async () => {
            const result = await PaymentsService.createCheckoutSession({
                body: { tierToUnlock: "PRO" },
                tenantId: testTenantId,
                userId: testUserId,
                clientIp: "127.0.0.1",
                countryCode: "US",
            });

            assertEquals(result.checkoutUrl, "https://checkout.stripe.com/test");
            assertEquals(result.sessionId, "cs_test_123");
            assertExists(result.externalId);

            // Verify DB transaction
            const [trx] = await db
                .select()
                .from(paymentTransactions)
                .where(eq(paymentTransactions.externalId, result.externalId));

            assertExists(trx);
            assertEquals(trx.status, "PENDING");
            assertEquals(trx.tierToUnlock, "PRO");
        });

        it("negative: rejects invalid tier", async () => {
            await assertRejects(
                () => PaymentsService.createCheckoutSession({
                    body: { tierToUnlock: "UNKNOWN" as any },
                    tenantId: testTenantId,
                    userId: testUserId,
                    clientIp: "127.0.0.1",
                    countryCode: "US",
                }),
                AppError,
                "Invalid tier to unlock"
            );
        });

        it("negative: rejects missing tenant", async () => {
            await assertRejects(
                () => PaymentsService.createCheckoutSession({
                    body: { tierToUnlock: "PRO" },
                    tenantId: crypto.randomUUID(),
                    userId: testUserId,
                    clientIp: "127.0.0.1",
                    countryCode: "US",
                }),
                AppError,
                "Tenant not found"
            );
        });

        it("negative: rejects claiming SIMULATE twice in a month", async () => {
            // First simulate payment success
            const txId = crypto.randomUUID();
            const now = new Date();
            await db.insert(paymentTransactions).values({
                id: txId,
                tenantId: testTenantId,
                externalId: `dokyudo-${testTenantId}-testsim`,
                tierToUnlock: "SIMULATE",
                amount: 0,
                currency: "IDR",
                status: "SUCCEEDED",
                paidAt: now
            });

            const req = {
                body: { tierToUnlock: "SIMULATE" as const },
                tenantId: testTenantId,
                userId: testUserId,
                clientIp: "127.0.0.1",
                countryCode: "US",
            };
            
            await assertRejects(
                () => PaymentsService.createCheckoutSession(req),
                AppError,
                "You can only claim the SIMULATE tier once per month"
            );

            // Cleanup
            await db.delete(paymentTransactions).where(eq(paymentTransactions.id, txId));
        });

        it("negative: throws on stripe error", async () => {
            checkoutStub.restore(); // Temporarily remove success stub
            const errorStub = stub(stripe.checkout.sessions, "create", () => {
                return Promise.reject(new Error("Stripe is down"));
            });

            await assertRejects(
                () => PaymentsService.createCheckoutSession({
                    body: { tierToUnlock: "PRO" },
                    tenantId: testTenantId,
                    userId: testUserId,
                    clientIp: "127.0.0.1",
                    countryCode: "US",
                }),
                AppError,
                "Failed to communicate with Stripe"
            );

            errorStub.restore();
            // Re-apply success stub for safety
            checkoutStub = stub(stripe.checkout.sessions, "create", () => {
                return Promise.resolve({
                    id: "cs_test_123",
                    url: "https://checkout.stripe.com/test",
                    amount_total: 1000,
                    currency: "usd",
                } as any);
            });
        });
    });

    describe("handleWebhook", () => {
        let externalId: string;

        beforeAll(async () => {
            externalId = `dokyudo-${testTenantId}-${Date.now()}`;
            await db.insert(paymentTransactions).values({
                tenantId: testTenantId,
                externalId,
                stripeSessionId: "cs_test_webhook",
                tierToUnlock: "PRO",
                amount: 1000,
                currency: "USD",
                status: "PENDING",
            });
        });

        it("positive: handles checkout.session.completed", async () => {
            const event = {
                type: "checkout.session.completed",
                data: {
                    object: {
                        client_reference_id: externalId,
                        customer: "cus_test_123",
                        subscription: "sub_test_123",
                        metadata: { tierToUnlock: "PRO" }
                    }
                }
            } as any;

            const result = await PaymentsService.handleWebhook({ event });
            assertEquals(result.acknowledged, true);

            // Check if transaction updated
            const [trx] = await db.select().from(paymentTransactions).where(eq(paymentTransactions.externalId, externalId));
            assertEquals(trx.status, "SUCCEEDED");
            assertEquals(trx.stripeCustomerId, "cus_test_123");

            // Check if subscription upgraded
            const [sub] = await db.select().from(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, testTenantId));
            assertExists(sub);
            assertEquals(sub.tier, "PRO");
            assertEquals(sub.stripeCustomerId, "cus_test_123");
            assertEquals(sub.stripeSubscriptionId, "sub_test_123");
        });

        it("negative: ignores unknown transaction in checkout completed", async () => {
            const event = {
                type: "checkout.session.completed",
                data: {
                    object: {
                        client_reference_id: "unknown_external_id",
                    }
                }
            } as any;

            const result = await PaymentsService.handleWebhook({ event });
            assertEquals(result.acknowledged, true);
            assertEquals(result.reason, "unknown_transaction");
        });

        it("positive: downgrades subscription on deleted", async () => {
            const event = {
                type: "customer.subscription.deleted",
                data: {
                    object: {
                        id: "sub_test_123",
                    }
                }
            } as any;

            await PaymentsService.handleWebhook({ event });

            const [sub] = await db.select().from(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, testTenantId));
            assertEquals(sub.tier, "FREE");
            assertEquals(sub.expiresAt, null);
        });
    });

    describe("createPortalSession", () => {
        let portalStub: Stub<any>;

        beforeAll(() => {
            portalStub = stub(stripe.billingPortal.sessions, "create", () => {
                return Promise.resolve({
                    url: "https://billing.stripe.com/test",
                } as any);
            });
        });

        afterAll(() => {
            portalStub.restore();
        });

        it("positive: creates portal session for active subscriber", async () => {
            // Setup active subscription with stripeCustomerId
            await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, testTenantId));
            await db.insert(tenantSubscriptions).values({
                tenantId: testTenantId,
                tier: "PRO",
                stripeCustomerId: "cus_portal_123",
            });

            const result = await PaymentsService.createPortalSession({
                tenantId: testTenantId,
                userId: testUserId,
            });

            assertEquals(result.portalUrl, "https://billing.stripe.com/test");
        });

        it("negative: rejects if tenant has no stripe customer", async () => {
            await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, testTenantId));

            await assertRejects(
                () => PaymentsService.createPortalSession({
                    tenantId: testTenantId,
                    userId: testUserId,
                }),
                AppError,
                "No active Stripe customer found"
            );
        });
    });
});
