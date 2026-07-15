import { db, withAuthDb } from "../../config/drizzle.ts";
import {
    paymentTransactions,
    tenantSubscriptions,
    tenants,
} from "../../shared/models/db.model.ts";
import { logActivity } from "../../shared/utils/activity.util.ts";
import { AppError } from "../../shared/utils/errors.util.ts";
import { stripe } from "../../config/stripe.ts";
import { CreateCheckoutBody } from "./payments.schema.ts";
import { eq, and, gte } from "drizzle-orm";
import type Stripe from "npm:stripe@^15.5.0";
import { getEnv } from "../../config/env.ts";

export class PaymentsService {
    /**
     * Creates a Stripe Checkout Session for Subscription.
     */
    static async createCheckoutSession(params: {
        body: CreateCheckoutBody;
        tenantId: string;
        userId: string;
        clientIp: string;
        countryCode: string;
        logContext?: Record<string, any>;
    }) {
        const { body, tenantId, userId, logContext } = params;

        const priceMap: Record<string, string> = {
            PRO: getEnv("STRIPE_PRICE_PRO"),
            SIMULATE: getEnv("STRIPE_PRICE_SIMULATE"),
            OIL_INVESTOR: getEnv("STRIPE_PRICE_OIL_INVESTOR"),
        };

        const priceId = priceMap[body.tierToUnlock];
        if (!priceId) {
            throw new AppError({
                code: "VALIDATION_ERROR",
                status: 400,
                message: "Invalid tier to unlock",
            });
        }

        const externalId = `dokyudo-${tenantId}-${Date.now()}`;

        // 2. Tenant Check
        const [tenant] = await withAuthDb(userId, async (tx) => {
            return await tx
                .select()
                .from(tenants)
                .where(eq(tenants.id, tenantId));
        });

        if (!tenant) {
            throw new AppError({
                code: "NOT_FOUND",
                status: 404,
                message: "Tenant not found",
            });
        }

        // 2.5 SIMULATE Tier Monthly Constraint
        if (body.tierToUnlock === "SIMULATE") {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const [existingSimulate] = await withAuthDb(userId, async (tx) => {
                return await tx
                    .select()
                    .from(paymentTransactions)
                    .where(
                        and(
                            eq(paymentTransactions.tenantId, tenantId),
                            eq(paymentTransactions.tierToUnlock, "SIMULATE"),
                            eq(paymentTransactions.status, "SUCCEEDED"),
                            gte(paymentTransactions.paidAt, startOfMonth)
                        )
                    )
                    .limit(1);
            });

            if (existingSimulate) {
                throw new AppError({
                    code: "VALIDATION_ERROR",
                    status: 400,
                    message: "You can only claim the SIMULATE tier once per month.",
                });
            }
        }

        // 3. Re-use Stripe Customer ID if it exists (prevents duplicate customers in Stripe Dashboard)
        const [sub] = await withAuthDb(userId, async (tx) => {
            return await tx
                .select()
                .from(tenantSubscriptions)
                .where(eq(tenantSubscriptions.tenantId, tenantId));
        });
        const stripeCustomerId = sub?.stripeCustomerId || undefined;

        const checkoutMode =
            body.tierToUnlock === "OIL_INVESTOR" ||
            body.tierToUnlock === "SIMULATE"
                ? "payment"
                : "subscription";

        let session: Stripe.Checkout.Session;
        try {
            session = await stripe.checkout.sessions.create({
                mode: checkoutMode,
                customer: stripeCustomerId,
                ...(checkoutMode === "payment" && !stripeCustomerId ? { customer_creation: "always" } : {}),
                client_reference_id: externalId,
                metadata: {
                    tenantId: tenantId,
                    tierToUnlock: body.tierToUnlock,
                },
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                // We do not pass payment_method_types per stripe-best-practices
                success_url:
                    `${getEnv("FRONTEND_URL")}/dashboard/billing/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${getEnv("FRONTEND_URL")}/dashboard/billing/cancel`,
            });
        } catch (error: any) {
            if (logContext) logContext.stripeError = error.message;
            throw new AppError({
                code: "PROVIDER_UNAVAILABLE",
                status: 502,
                message: "Failed to communicate with Stripe",
            });
        }

        // 5. Store Transaction state in DB
        const [trx] = await withAuthDb(userId, async (tx) => {
            return await tx
                .insert(paymentTransactions)
                .values({
                    tenantId,
                    externalId,
                    stripeSessionId: session.id,
                    tierToUnlock: body.tierToUnlock as any,
                    amount: session.amount_total || 0,
                    currency: (session.currency || "USD").toUpperCase(),
                    status: "PENDING",
                })
                .returning();
        });

        return {
            checkoutUrl: session.url,
            sessionId: trx.stripeSessionId,
            externalId: trx.externalId,
        };
    }

    /**
     * Handles Server-to-Server callbacks from Stripe Webhooks.
     */
    static async handleWebhook(params: {
        event: Stripe.Event;
        logContext?: Record<string, any>;
    }) {
        const { event, logContext } = params;

        if (logContext) logContext.stripeEventType = event.type;

        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;

                // 1. Fetch transaction
                const externalId = session.client_reference_id;
                if (!externalId)
                    return {
                        acknowledged: true,
                        reason: "no_client_reference_id",
                    };

                const [trx] = await db
                    .select()
                    .from(paymentTransactions)
                    .where(eq(paymentTransactions.externalId, externalId));

                if (!trx) {
                    if (logContext)
                        logContext.webhookWarning = `Unknown reference_id: ${externalId}`;
                    return {
                        acknowledged: true,
                        reason: "unknown_transaction",
                    };
                }

                // 2. Update Transaction
                await db
                    .update(paymentTransactions)
                    .set({
                        status: "SUCCEEDED",
                        stripeCustomerId: session.customer as string,
                        webhookPayload: event as any,
                        paidAt: new Date(),
                        updatedAt: new Date(),
                    })
                    .where(eq(paymentTransactions.id, trx.id));

                // 3. Upgrade Tenant Subscription
                const tierToUnlock =
                    session.metadata?.tierToUnlock || trx.tierToUnlock;

                const [sub] = await db
                    .select()
                    .from(tenantSubscriptions)
                    .where(eq(tenantSubscriptions.tenantId, trx.tenantId));

                if (sub) {
                    await db
                        .update(tenantSubscriptions)
                        .set({
                            tier: tierToUnlock as any,
                            stripeCustomerId: session.customer as string,
                            stripeSubscriptionId: session.subscription
                                ? (session.subscription as string)
                                : sub.stripeSubscriptionId,
                            ...(tierToUnlock === "SIMULATE"
                                ? {
                                      expiresAt: new Date(
                                          Date.now() + 24 * 60 * 60 * 1000,
                                      ),
                                  }
                                : tierToUnlock === "OIL_INVESTOR"
                                  ? { expiresAt: null }
                                  : {}),
                            updatedAt: new Date(),
                        })
                        .where(eq(tenantSubscriptions.tenantId, trx.tenantId));
                } else {
                    await db.insert(tenantSubscriptions).values({
                        tenantId: trx.tenantId,
                        tier: tierToUnlock as any,
                        stripeCustomerId: session.customer as string,
                        stripeSubscriptionId: session.subscription
                            ? (session.subscription as string)
                            : null,
                    });
                }
                
                await logActivity({
                    tenantId: trx.tenantId,
                    action: "billing.payment_completed",
                    resourceType: "payment",
                    resourceId: trx.id,
                    metadata: { amount: session.amount_total, currency: session.currency, tier: tierToUnlock },
                    requestId: logContext?.requestId,
                });
                break;
            }
            case "customer.subscription.created":
            case "customer.subscription.updated": {
                const subscription = event.data.object as Stripe.Subscription;

                // If user canceled via Customer Portal, cancel_at_period_end becomes true.
                // We set expiresAt to cancel_at timestamp. If they renew, it becomes null (indefinite).
                const isCanceling = subscription.cancel_at_period_end;
                const expiresAt =
                    isCanceling && typeof subscription.cancel_at === "number"
                        ? new Date(subscription.cancel_at * 1000)
                        : null;

                await db
                    .update(tenantSubscriptions)
                    .set({ expiresAt, updatedAt: new Date() })
                    .where(
                        eq(
                            tenantSubscriptions.stripeSubscriptionId,
                            subscription.id,
                        ),
                    );
                break;
            }
            case "customer.subscription.deleted": {
                const subscription = event.data.object as Stripe.Subscription;
                // Downgrade to FREE when subscription is completely canceled/deleted by Stripe
                await db
                    .update(tenantSubscriptions)
                    .set({
                        tier: "FREE",
                        expiresAt: null,
                        updatedAt: new Date(),
                    })
                    .where(
                        eq(
                            tenantSubscriptions.stripeSubscriptionId,
                            subscription.id,
                        ),
                    );
                break;
            }
            default:
                if (logContext) logContext.unhandledEvent = true;
                break;
        }

        return { acknowledged: true, eventType: event.type };
    }

    /**
     * Creates a Stripe Customer Portal Session for managing subscriptions.
     */
    static async createPortalSession(params: {
        tenantId: string;
        userId: string;
        logContext?: Record<string, any>;
    }) {
        const { tenantId, userId, logContext } = params;

        const [sub] = await withAuthDb(userId, async (tx) => {
            return await tx
                .select()
                .from(tenantSubscriptions)
                .where(eq(tenantSubscriptions.tenantId, tenantId));
        });

        if (!sub || !sub.stripeCustomerId) {
            throw new AppError({
                code: "VALIDATION_ERROR",
                status: 400,
                message: "No active Stripe customer found for this tenant",
            });
        }

        try {
            const portalSession = await stripe.billingPortal.sessions.create({
                customer: sub.stripeCustomerId,
                return_url: `${getEnv("FRONTEND_URL")}/dashboard/billing`,
            });

            return {
                portalUrl: portalSession.url,
            };
        } catch (error: any) {
            if (logContext) logContext.stripeError = error.message;
            throw new AppError({
                code: "PROVIDER_UNAVAILABLE",
                status: 502,
                message: "Failed to communicate with Stripe Billing Portal",
            });
        }
    }
}
