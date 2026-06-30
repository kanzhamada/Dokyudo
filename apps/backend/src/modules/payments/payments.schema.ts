import { z } from "zod";

// ============================================================================
// 1. CHECKOUT SCHEMAS
// ============================================================================
export const CreateCheckoutBodySchema = z.object({
    tierToUnlock: z.enum(["INVESTOR", "REAL"], {
        required_error: "Tier to unlock is required",
        invalid_type_error: "Tier must be INVESTOR or REAL",
    }),
});
export type CreateCheckoutBody = z.infer<typeof CreateCheckoutBodySchema>;

export const CheckoutResponseSchema = z.object({
    checkoutUrl: z.string().url(),
    paymentRequestId: z.string(),
    externalId: z.string(),
});
export type CheckoutResponse = z.infer<typeof CheckoutResponseSchema>;

// ============================================================================
// 2. WEBHOOK SCHEMAS
// ============================================================================
export const WebhookHeadersSchema = z.object({
    "x-callback-token": z.string({
        required_error: "x-callback-token header is required for webhook verification",
    }),
});
export type WebhookHeaders = z.infer<typeof WebhookHeadersSchema>;

// We keep Xendit webhook payload somewhat loose as it can change and is complex,
// but we require at least the fields we strictly depend on for reconciliation.
export const WebhookPayloadSchema = z.object({
    event: z.string(),
    data: z.object({
        reference_id: z.string(),
        status: z.string(),
        failure_code: z.string().nullable().optional(),
    }).passthrough(),
}).passthrough();
export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;
