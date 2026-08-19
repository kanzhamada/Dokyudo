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
import { hashUserEmail } from "../../shared/utils/hash.util.ts";

describe("PaymentsService", () => {
    let testTenantId: string;
    let testUserId: string;
    let testUserEmail: string;

    beforeAll(async () => {
        testTenantId = crypto.randomUUID();
        testUserId = crypto.randomUUID();
        testUserEmail = `payment-test-${testTenantId}@example.com`;

        await db.insert(tenants).values({
            id: testTenantId,
            name: "Payment Test Tenant",
        });

        await db.insert(users).values({
            id: testUserId,
            tenantId: testTenantId,
            email: testUserEmail,
        });
    });

    afterAll(async () => {
        await db.delete(paymentTransactions).where(eq(paymentTransactions.tenantId, testTenantId));
        await db.delete(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, testTenantId));
        await db.delete(users).where(eq(users.id, testUserId));
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
            assertEquals(trx.userEmailHash, await hashUserEmail(testUserEmail));
        });

        it("negative: rejects invalid tier", async () => {
            await assertRejects(
                () => PaymentsService.createCheckoutSession({
                    body: { tierToUnlock: "UNKNOWN" as any },
                    tenantId: testTenantId,
                    userId: testUserId,
                    clientIp: "127.0.0.1",
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
                }),
                AppError,
                "Tenant not found"
            );
        });

        it("negative: rejects claiming SIMULATE twice in 30 days on same account", async () => {
            const emailHash = await hashUserEmail(testUserEmail);
            const txId = crypto.randomUUID();
            const now = new Date();
            await db.insert(paymentTransactions).values({
                id: txId,
                tenantId: testTenantId,
                userEmailHash: emailHash,
                externalId: `dokyudo-${testTenantId}-${Date.now()}`,
                tierToUnlock: "SIMULATE",
                amount: 0,
                currency: "USD",
                status: "SUCCEEDED",
                paidAt: now,
                createdAt: now,
                updatedAt: now,
            });

            await assertRejects(
                () => PaymentsService.createCheckoutSession({
                    body: { tierToUnlock: "SIMULATE" },
                    tenantId: testTenantId,
                    userId: testUserId,
                    clientIp: "127.0.0.1",
                }),
                AppError,
                "SIMULATE tier can only be claimed once per 30 days"
            );

            // Cleanup
            await db.delete(paymentTransactions).where(eq(paymentTransactions.id, txId));
        });

        it("negative: rejects claiming SIMULATE across deleted account and re-registration with same email", async () => {
            const userEmail = `simulate-cross-${crypto.randomUUID()}@example.com`;
            const emailHash = await hashUserEmail(userEmail);

            const oldTenantId = crypto.randomUUID();
            const oldUserId = crypto.randomUUID();
            const newTenantId = crypto.randomUUID();
            const newUserId = crypto.randomUUID();

            // 1. Old account existed and had a successful SIMULATE claim
            await db.insert(tenants).values({ id: oldTenantId, name: "Deleted Account", deletionStatus: "deleted" });
            await db.insert(users).values({ id: oldUserId, tenantId: oldTenantId, email: `deleted:${oldUserId}`, deletionStatus: "deleted" });
            const oldTxId = crypto.randomUUID();
            await db.insert(paymentTransactions).values({
                id: oldTxId,
                tenantId: oldTenantId,
                userEmailHash: emailHash,
                externalId: `dokyudo-${oldTenantId}-simulate`,
                tierToUnlock: "SIMULATE",
                amount: 0,
                currency: "USD",
                status: "SUCCEEDED",
                paidAt: new Date(),
            });

            // 2. New account registered with the same email
            await db.insert(tenants).values({ id: newTenantId, name: "New Tenant" });
            await db.insert(users).values({ id: newUserId, tenantId: newTenantId, email: userEmail, deletionStatus: "active" });

            try {
                await assertRejects(
                    () => PaymentsService.createCheckoutSession({
                        body: { tierToUnlock: "SIMULATE" },
                        tenantId: newTenantId,
                        userId: newUserId,
                        clientIp: "127.0.0.1",
                    }),
                    AppError,
                    "SIMULATE tier can only be claimed once per 30 days"
                );
            } finally {
                await db.delete(paymentTransactions).where(eq(paymentTransactions.id, oldTxId));
                await db.delete(users).where(eq(users.id, oldUserId));
                await db.delete(tenants).where(eq(tenants.id, oldTenantId));
                await db.delete(users).where(eq(users.id, newUserId));
                await db.delete(tenants).where(eq(tenants.id, newTenantId));
            }
        });

        it("negative: handles stripe api error gracefully", async () => {
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
                        metadata: { tierToUnlock: "PRO", tenantId: testTenantId }
                    }
                }
            } as any;

            const result = await PaymentsService.handleWebhook({ event });
            assertEquals(result.received, true);

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
            assertEquals(result.received, true);
        });

        it("positive: downgrades subscription on deleted", async () => {
            const event = {
                type: "customer.subscription.deleted",
                data: {
                    object: {
                        id: "sub_test_123",
                        customer: "cus_test_123",
                    }
                }
            } as any;

            await PaymentsService.handleWebhook({ event });

            const [sub] = await db.select().from(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, testTenantId));
            assertEquals(sub.tier, "SIMULATE");
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
