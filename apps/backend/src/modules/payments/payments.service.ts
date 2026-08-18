import { db, withAuthDb } from "../../config/drizzle.ts";
import {
    paymentTransactions,
    tenantSubscriptions,
    tenants,
    users,
} from "../../shared/models/db.model.ts";
import { logActivity } from "../../shared/utils/activity.util.ts";
import { sendPaymentSuccessEmail } from "../../shared/utils/email.util.ts";
import { AppError } from "../../shared/utils/errors.util.ts";
import { stripe } from "../../config/stripe.ts";
import { CreateCheckoutBody, VerifyCheckoutSessionParams, VerifyCheckoutSessionResponse } from "./payments.schema.ts";
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
        userAgent?: string;
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

        // 2. Tenant Check (must be an ACTIVE account — a deleted/deletion-pending
        // tenant can never start a new checkout)
        const [tenant] = await withAuthDb(userId, async (tx) => {
            return await tx
                .select()
                .from(tenants)
                .where(
                    and(
                        eq(tenants.id, tenantId),
                        eq(tenants.deletionStatus, "active"),
                    ),
                );
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
                    externalId: externalId,
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
                    `${getEnv("FRONTEND_URL")}/app/billing/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${getEnv("FRONTEND_URL")}/app?billing=open`,
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
        clientIp?: string;
        userAgent?: string;
        logContext?: Record<string, any>;
    }) {
        const { event, logContext } = params;

        if (logContext) logContext.stripeEventType = event.type;

        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;

                // 1. Validate custom metadata attached during checkout session creation
                // Fall back to client_reference_id for resilience (some test fixtures omit metadata).
                const tenantId = session.metadata?.tenantId;
                const externalId =
                    session.metadata?.externalId ??
                    (typeof session.client_reference_id === "string"
                        ? session.client_reference_id
                        : undefined);
                const tierToUnlock = session.metadata?.tierToUnlock;

                if (!tenantId || !externalId || !tierToUnlock) {
                    if (logContext) logContext.webhookWarning = "Missing metadata in checkout.session.completed";
                    break;
                }

                // 2. Query payment transaction record to avoid duplicate fulfillment
                const [trx] = await db
                    .select()
                    .from(paymentTransactions)
                    .where(eq(paymentTransactions.externalId, externalId));

                if (!trx) {
                    if (logContext) logContext.webhookWarning = `Payment transaction not found for externalId: ${externalId}`;
                    break;
                }

                if (trx.status === "SUCCEEDED") {
                    if (logContext) logContext.webhookInfo = `Payment transaction ${externalId} already completed. Skipping.`;
                    break;
                }

                // 3. Mark payment transaction as SUCCEEDED
                await db
                    .update(paymentTransactions)
                    .set({
                        status: "SUCCEEDED",
                        stripeCustomerId: session.customer as string,
                        paidAt: new Date(),
                        updatedAt: new Date(),
                    })
                    .where(eq(paymentTransactions.id, trx.id));

                // 3.5 Guard: never provision a deleted / deletion-pending
                // tenant. The payment is still recorded for the immutable
                // ledger, but the account is terminal — no tier upgrade, no
                // subscription binding, no email.
                const [activeTenant] = await db
                    .select({ deletionStatus: tenants.deletionStatus })
                    .from(tenants)
                    .where(eq(tenants.id, trx.tenantId));
                if (!activeTenant || activeTenant.deletionStatus !== "active") {
                    if (logContext) {
                        logContext.webhookInfo = `Payment ${externalId} recorded but tenant ${trx.tenantId} is ${activeTenant?.deletionStatus ?? "missing"} — provisioning skipped`;
                    }
                    break;
                }

                // 4. Provision / Upgrade Tenant Subscription
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
                    ipAddress: params.clientIp,
                    userAgent: params.userAgent,
                    requestId: logContext?.requestId,
                }, logContext);

                // 5. Send the payment confirmation email with the summary.
                // Best-effort: a delivery failure must never break the webhook
                // acknowledgement (Stripe would retry the whole event).
                await PaymentsService.sendPaymentSuccessNotification({
                    tenantId: trx.tenantId,
                    tier: tierToUnlock,
                    amountMinor: session.amount_total ?? trx.amount ?? 0,
                    currency: session.currency ?? trx.currency ?? "USD",
                    paidAt: new Date(),
                    externalId: trx.externalId,
                    logContext,
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

                const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

                await db
                    .update(tenantSubscriptions)
                    .set({
                        stripeSubscriptionId: subscription.id,
                        expiresAt: expiresAt,
                        updatedAt: new Date(),
                    })
                    .where(eq(tenantSubscriptions.stripeCustomerId, customerId));

                break;
            }
            case "customer.subscription.deleted": {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

                // Revert to FREE / SIMULATE tier upon cancellation expiration
                await db
                    .update(tenantSubscriptions)
                    .set({
                        tier: "SIMULATE",
                        updatedAt: new Date(),
                    })
                    .where(eq(tenantSubscriptions.stripeCustomerId, customerId));

                break;
            }
            case "checkout.session.async_payment_failed": {
                const session = event.data.object as Stripe.Checkout.Session;
                const tenantId = session.metadata?.tenantId;
                const externalId = session.metadata?.externalId;
                const tierToUnlock = session.metadata?.tierToUnlock;

                if (externalId) {
                    await db
                        .update(paymentTransactions)
                        .set({
                            status: "FAILED",
                            updatedAt: new Date(),
                        })
                        .where(eq(paymentTransactions.externalId, externalId));
                }

                if (tenantId) {
                    await logActivity({
                        tenantId,
                        action: "billing.payment_failed",
                        resourceType: "payment",
                        resourceId: externalId || undefined,
                        metadata: { tier: tierToUnlock, reason: "Async payment failed" },
                        ipAddress: params.clientIp,
                        userAgent: params.userAgent,
                        requestId: logContext?.requestId,
                    }, logContext);
                }
                break;
            }
            case "invoice.payment_failed": {
                const invoice = event.data.object as Stripe.Invoice;
                const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;

                if (customerId) {
                    const [sub] = await db
                        .select({ tenantId: tenantSubscriptions.tenantId })
                        .from(tenantSubscriptions)
                        .where(eq(tenantSubscriptions.stripeCustomerId, customerId));

                    if (sub) {
                        await logActivity({
                            tenantId: sub.tenantId,
                            action: "billing.payment_failed",
                            resourceType: "payment",
                            metadata: {
                                amount: invoice.amount_due,
                                currency: invoice.currency,
                                reason: invoice.last_finalization_error?.message || "Invoice payment failed",
                            },
                            ipAddress: params.clientIp,
                            userAgent: params.userAgent,
                            requestId: logContext?.requestId,
                        }, logContext);
                    }
                }
                break;
            }
        }

        return { received: true };
    }

    /**
     * Creates a Stripe Customer Portal Session for managing subscriptions.
     */
    static async createPortalSession(params: {
        tenantId: string;
        userId: string;
        clientIp?: string;
        userAgent?: string;
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
                return_url: `${getEnv("FRONTEND_URL")}/app/dashboard`,
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

    /**
     * Verifies a Stripe Checkout session for the authenticated tenant, used by
     * the /app/billing/success page.
     *
     * Security contract:
     * - The session_id in the URL is attacker-controlled, so it is never
     *   trusted as-is. It is retrieved from Stripe with the secret key.
     * - The session must belong to the authenticated tenant: session metadata
     *   `tenantId` must match the tenant bound to the access token (falls back
     *   to the paymentTransactions row for resilience).
     * - Failures return a generic 404 and never reveal whether a session
     *   belongs to another tenant.
     * - This endpoint only informs UI state. Tier provisioning remains the
     *   sole job of the signature-verified Stripe webhook.
     */
    static async verifyCheckoutSession(
        params: VerifyCheckoutSessionParams,
    ): Promise<VerifyCheckoutSessionResponse> {
        let session: Stripe.Checkout.Session;
        try {
            session = await stripe.checkout.sessions.retrieve(params.sessionId);
        } catch (err: any) {
            if (params.logContext) params.logContext.stripeVerifyError = err.message;
            throw new AppError({
                code: "NOT_FOUND",
                status: 404,
                message: "Unable to verify payment session",
            });
        }

        // Binding: the session must belong to the authenticated tenant.
        const metadataTenantId = session.metadata?.tenantId;
        let belongsToTenant =
            typeof metadataTenantId === "string" && metadataTenantId === params.tenantId;

        if (!belongsToTenant) {
            // Fallback for sessions created without metadata (e.g. old fixtures):
            // bind through the stored transaction row instead.
            const [trx] = await db
                .select({ tenantId: paymentTransactions.tenantId })
                .from(paymentTransactions)
                .where(eq(paymentTransactions.stripeSessionId, params.sessionId));

            belongsToTenant = trx?.tenantId === params.tenantId;
        }

        if (!belongsToTenant) {
            throw new AppError({
                code: "NOT_FOUND",
                status: 404,
                message: "Unable to verify payment session",
            });
        }

        return {
            valid: true,
            status: session.payment_status ?? "unpaid",
            tier: session.metadata?.tierToUnlock ?? null,
        };
    }

    /** Human-readable tier labels for receipts (mirrors the billing UI). */
    static readonly TIER_LABELS: Record<string, string> = {
        SIMULATE: "Sandbox & Evaluation",
        OIL_INVESTOR: "Pro Investor",
        PRO: "Pro Real",
    };

    /**
     * Sends the payment success notification email for a completed checkout.
     * Best-effort by design: the email is a receipt, not provisioning — failures
     * are logged and swallowed so the webhook can always acknowledge Stripe.
     */
    private static async sendPaymentSuccessNotification(params: {
        tenantId: string;
        tier: string;
        amountMinor: number;
        currency: string;
        paidAt: Date;
        externalId: string;
        logContext?: Record<string, any>;
    }): Promise<void> {
        try {
            // Pick the tenant's first (owner) user as the recipient.
            const [userRow] = await db
                .select({ email: users.email })
                .from(users)
                .where(eq(users.tenantId, params.tenantId))
                .orderBy(users.createdAt)
                .limit(1);

            if (!userRow) {
                if (params.logContext) params.logContext.emailWarning = "No user found for tenant";
                return;
            }

            await sendPaymentSuccessEmail({
                email: userRow.email,
                planName: PaymentsService.TIER_LABELS[params.tier] ?? params.tier,
                amountMinor: params.amountMinor,
                currency: params.currency,
                paidAt: params.paidAt,
                dashboardUrl: `${getEnv("FRONTEND_URL")}/app?billing=open`,
                externalId: params.externalId,
                logContext: params.logContext,
            });
        } catch (err: any) {
            // Never propagate: the webhook response is independent of email delivery.
            if (params.logContext) params.logContext.emailError = err.message;
        }
    }
}
