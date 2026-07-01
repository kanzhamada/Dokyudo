import { db } from "../../config/drizzle.ts";
import { paymentTransactions, tenantSubscriptions, tenants } from "../../shared/models/db.model.ts";
import { AppError } from "../../shared/utils/errors.util.ts";
import { stripe } from "../../config/stripe.ts";
import { CreateCheckoutBody } from "./payments.schema.ts";
import { eq } from "drizzle-orm";
import type Stripe from "npm:stripe@^15.5.0";

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
        const { body, tenantId, logContext } = params;

        // 1. Pricing Logic (Inline Price Data for Sandbox)
        // In production, you would fetch predefined Price IDs from Stripe.
        let amount = body.tierToUnlock === "INVESTOR" ? 150000 : 50000; // Cents (e.g., $1500.00 / $500.00)
        
        const externalId = `dokyudo-${tenantId}-${Date.now()}`;

        // 2. Tenant Check
        const [tenant] = await db
            .select()
            .from(tenants)
            .where(eq(tenants.id, tenantId));
            
        if (!tenant) {
            throw new AppError({
                code: "NOT_FOUND",
                status: 404,
                message: "Tenant not found",
            });
        }

        let session: Stripe.Checkout.Session;
        try {
            session = await stripe.checkout.sessions.create({
                mode: 'subscription',
                client_reference_id: externalId,
                metadata: {
                    tenantId: tenantId,
                    tierToUnlock: body.tierToUnlock,
                },
                line_items: [
                    {
                        price_data: {
                            currency: 'usd',
                            recurring: { interval: 'month' },
                            product_data: {
                                name: `Dokyudo ${body.tierToUnlock} Tier`,
                                description: "Monthly SaaS Subscription",
                            },
                            unit_amount: amount,
                        },
                        quantity: 1,
                    },
                ],
                // We do not pass payment_method_types per stripe-best-practices
                success_url: "http://localhost:5173/dashboard/billing/success?session_id={CHECKOUT_SESSION_ID}",
                cancel_url: "http://localhost:5173/dashboard/billing/cancel",
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
        const [trx] = await db
            .insert(paymentTransactions)
            .values({
                tenantId,
                externalId,
                stripeSessionId: session.id,
                tierToUnlock: body.tierToUnlock,
                amount,
                currency: "USD",
                status: "PENDING",
            })
            .returning();

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
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                
                // 1. Fetch transaction
                const externalId = session.client_reference_id;
                if (!externalId) return { acknowledged: true, reason: "no_client_reference_id" };

                const [trx] = await db
                    .select()
                    .from(paymentTransactions)
                    .where(eq(paymentTransactions.externalId, externalId));

                if (!trx) {
                    if (logContext) logContext.webhookWarning = `Unknown reference_id: ${externalId}`;
                    return { acknowledged: true, reason: "unknown_transaction" };
                }

                // 2. Update Transaction
                await db
                    .update(paymentTransactions)
                    .set({
                        status: "SUCCEEDED",
                        stripeCustomerId: session.customer as string,
                        webhookPayload: event as any,
                        paidAt: new Date(),
                    })
                    .where(eq(paymentTransactions.id, trx.id));

                // 3. Upgrade Tenant Subscription
                const tierToUnlock = session.metadata?.tierToUnlock || trx.tierToUnlock;
                
                const [sub] = await db.select().from(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, trx.tenantId));
                
                if (sub) {
                    await db.update(tenantSubscriptions).set({
                        tier: tierToUnlock as any,
                        stripeCustomerId: session.customer as string,
                        stripeSubscriptionId: session.subscription as string,
                        updatedAt: new Date()
                    }).where(eq(tenantSubscriptions.tenantId, trx.tenantId));
                } else {
                    await db.insert(tenantSubscriptions).values({
                        tenantId: trx.tenantId,
                        tier: tierToUnlock as any,
                        stripeCustomerId: session.customer as string,
                        stripeSubscriptionId: session.subscription as string,
                    });
                }
                break;
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                // Downgrade to FREE when subscription is canceled/deleted
                await db.update(tenantSubscriptions)
                    .set({ tier: "FREE", updatedAt: new Date() })
                    .where(eq(tenantSubscriptions.stripeSubscriptionId, subscription.id));
                break;
            }
            default:
                if (logContext) logContext.unhandledEvent = true;
                break;
        }

        return { acknowledged: true, eventType: event.type };
    }
}
