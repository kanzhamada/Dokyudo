import { ContextExtractor } from "../../shared/utils/context.util.ts";
import { PaymentsService } from "./payments.service.ts";
import * as PaymentsSchema from "./payments.schema.ts";
import { type Context } from "hono";
import { XenditClient } from "../../config/xendit.ts";
import { AppError } from "../../shared/utils/errors.util.ts";

export async function handleCheckout(c: Context) {
    const extractor = new ContextExtractor(c);
    const { logContext, clientIp } = extractor.extractAuditContext();
    const { tenantId, userId } = extractor.extractAuthContext();
    const body = extractor.extractValidJson<PaymentsSchema.CreateCheckoutBody>();

    const result = await PaymentsService.createCheckoutSession({
        body,
        tenantId,
        userId,
        clientIp,
        logContext,
    });

    return c.json(result, 201);
}

export async function handleWebhook(c: Context) {
    const extractor = new ContextExtractor(c);
    const { logContext } = extractor.extractAuditContext();
    
    // 1. Verify Webhook Signature / Token (from Headers)
    const callbackToken = c.req.header("x-callback-token");
    if (!XenditClient.verifyWebhookToken(callbackToken)) {
        if (logContext) logContext.webhookAuthError = "Invalid x-callback-token";
        throw new AppError({
            code: "UNAUTHORIZED",
            status: 401,
            message: "Invalid webhook signature"
        });
    }

    // 2. Extract and Validate Payload loosely
    const payload = extractor.extractValidJson<PaymentsSchema.WebhookPayload>();

    // 3. Process via Service
    const result = await PaymentsService.handleWebhook({
        payload,
        logContext,
    });

    // 4. Always return 200 OK so Xendit stops retrying
    return c.json(result, 200);
}
