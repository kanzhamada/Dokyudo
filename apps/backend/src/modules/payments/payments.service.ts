import { db } from "../../config/drizzle.ts";
import { paymentTransactions, tenantSubscriptions, tenants } from "../../shared/models/db.model.ts";
import { AppError } from "../../shared/utils/errors.util.ts";
import { XenditClient } from "../../config/xendit.ts";
import { CreateCheckoutBody, WebhookPayload } from "./payments.schema.ts";
import { eq } from "drizzle-orm";

export class PaymentsService {
    /**
     * Creates a dummy/sandbox payment intent via Xendit API v3.
     */
    static async createCheckoutSession(params: {
        body: CreateCheckoutBody;
        tenantId: string;
        userId: string;
        clientIp: string;
        logContext?: Record<string, any>;
    }) {
        const { body, tenantId, logContext } = params;

        // 1. Pricing Logic
        const amount = body.tierToUnlock === "INVESTOR" ? 1500000 : 500000;
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

        // 3. Prepare Xendit Request
        const xenditPayload = {
            reference_id: externalId,
            type: "PAY",
            currency: "IDR",
            request_amount: amount,
            country: "ID",
            channel_code: "SHOPEEPAY",
            channel_properties: {
                success_return_url: "http://localhost:5173/dashboard/billing/success",
                failure_return_url: "http://localhost:5173/dashboard/billing/failure",
            }
        };

        let xenditResponse;
        try {
            console.log("=== XENDIT PAYLOAD ===");
            console.log(JSON.stringify(xenditPayload, null, 2));
            console.log("======================");
            
            xenditResponse = await XenditClient.createPaymentRequest(xenditPayload);
        } catch (error: any) {
            console.error("=== XENDIT ERROR ===");
            console.error(error.message);
            console.error("====================");
            
            if (logContext) logContext.xenditError = error.message;
            throw new AppError({
                code: "PROVIDER_UNAVAILABLE",
                status: 502,
                message: "Failed to communicate with Xendit Payment Gateway",
            });
        }

        // 4. Extract actions (Checkout URL for the user to scan/pay)
        const actions = xenditResponse.actions || [];
        const redirectAction = actions.find((a: any) => a.action_type === "WEB" || a.urlType === "WEB" || a.type === "REDIRECT_CUSTOMER" || a.descriptor === "DEEPLINK_URL");
        const checkoutUrl = redirectAction ? (redirectAction.url || redirectAction.value) : "";
        const paymentReqId = xenditResponse.payment_request_id || xenditResponse.id;

        // 5. Store Transaction state in DB
        const [trx] = await db
            .insert(paymentTransactions)
            .values({
                tenantId,
                externalId,
                paymentRequestId: paymentReqId,
                tierToUnlock: body.tierToUnlock,
                amount,
                currency: "IDR",
                status: "PENDING",
                paymentActions: actions,
            })
            .returning();

        return {
            checkoutUrl,
            paymentRequestId: trx.paymentRequestId,
            externalId: trx.externalId,
        };
    }

    /**
     * Handles Server-to-Server callbacks from Xendit.
     * Guaranteed Idempotent by externalId (reference_id).
     */
    static async handleWebhook(params: {
        payload: WebhookPayload;
        logContext?: Record<string, any>;
    }) {
        const { payload, logContext } = params;

        const externalId = payload.data?.reference_id;
        // Xendit status enum typically aligns with SUCCEEDED, FAILED, EXPIRED, CANCELED
        const status = payload.data?.status; 

        if (!externalId) {
            throw new AppError({
                code: "VALIDATION_ERROR",
                status: 400,
                message: "Missing reference_id in webhook payload",
            });
        }

        // 1. Fetch transaction
        const [trx] = await db
            .select()
            .from(paymentTransactions)
            .where(eq(paymentTransactions.externalId, externalId));

        if (!trx) {
            if (logContext) logContext.webhookWarning = `Unknown reference_id: ${externalId}`;
            return { acknowledged: true, reason: "unknown_transaction" };
        }

        // 2. Idempotency Check
        if (trx.status === "SUCCEEDED" || trx.status === "FAILED") {
            if (logContext) logContext.webhookInfo = `Transaction ${externalId} already processed`;
            return { acknowledged: true, reason: "already_processed" };
        }

        // 3. Status casting (safety wrapper for DB Enum constraints)
        let dbStatus: any = "PENDING";
        if (["SUCCEEDED", "FAILED", "EXPIRED", "CANCELED"].includes(status)) {
            dbStatus = status;
        }

        // 4. Update Transaction
        await db
            .update(paymentTransactions)
            .set({
                status: dbStatus,
                failureCode: payload.data?.failure_code || null,
                webhookPayload: payload,
                paidAt: status === "SUCCEEDED" ? new Date() : null,
            })
            .where(eq(paymentTransactions.id, trx.id));

        // 5. Upgrade Tenant Tier if Successful
        if (status === "SUCCEEDED") {
            try {
                // Upsert/Update the tenant subscription
                // Check if exists first to handle cases where subscription row might not exist yet
                const [sub] = await db.select().from(tenantSubscriptions).where(eq(tenantSubscriptions.tenantId, trx.tenantId));
                
                if (sub) {
                    await db.update(tenantSubscriptions).set({
                        tier: trx.tierToUnlock as any,
                        updatedAt: new Date()
                    }).where(eq(tenantSubscriptions.tenantId, trx.tenantId));
                } else {
                    await db.insert(tenantSubscriptions).values({
                        tenantId: trx.tenantId,
                        tier: trx.tierToUnlock as any,
                    });
                }
                
                if (logContext) logContext.upgradedTier = trx.tierToUnlock;
                
            } catch (error: any) {
                if (logContext) logContext.dbError = error.message;
                throw new AppError({
                    code: "INTERNAL_ERROR",
                    status: 500,
                    message: "Failed to apply tier upgrade",
                });
            }
        }

        return { acknowledged: true, statusUpdatedTo: dbStatus };
    }
}
