import { ContextExtractor } from "../../shared/utils/context.util.ts";
import { PaymentsService } from "./payments.service.ts";
import * as PaymentsSchema from "./payments.schema.ts";
import { type Context } from "hono";
import { AppError } from "../../shared/utils/errors.util.ts";
import { getStripeWebhookSecret, stripe } from "../../config/stripe.ts";

export async function handleCheckout(c: Context) {
    const extractor = new ContextExtractor(c);
    const { logContext, clientIp } = extractor.extractAuditContext();
    const { tenantId, userId } = extractor.extractAuthContext();
    const body = extractor.extractValidJson<PaymentsSchema.CreateCheckoutBody>();

    const countryCode = c.req.header("CF-IPCountry") || "US";

    const result = await PaymentsService.createCheckoutSession({
        body,
        tenantId,
        userId,
        clientIp,
        countryCode,
        logContext,
    });

    return c.json(result, 201);
}

export async function handleWebhook(c: Context) {
    const extractor = new ContextExtractor(c);
    const { logContext } = extractor.extractAuditContext();
    
    // 1. Stripe Webhooks require raw text body for signature verification
    const sig = c.req.header("stripe-signature");
    if (!sig) {
        throw new AppError({
            code: "UNAUTHORIZED",
            status: 401,
            message: "Missing stripe-signature header"
        });
    }

    const rawBody = await c.req.text();
    let event;

    try {
        event = await stripe.webhooks.constructEventAsync(rawBody, sig, getStripeWebhookSecret());
    } catch (err: any) {
        if (logContext) logContext.webhookAuthError = err.message;
        throw new AppError({
            code: "UNAUTHORIZED",
            status: 401,
            message: `Webhook Error: ${err.message}`
        });
    }

    // 3. Process via Service
    const result = await PaymentsService.handleWebhook({
        event,
        logContext,
    });

    // 4. Always return 200 OK so Stripe stops retrying
    return c.json(result, 200);
}
