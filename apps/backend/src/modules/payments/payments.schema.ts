import { z } from "zod";

// ============================================================================
// 1. CHECKOUT SCHEMAS
// ============================================================================
export const CreateCheckoutBodySchema = z.object({
    tierToUnlock: z.enum(["SIMULATE", "OIL_INVESTOR", "PRO"], {
        required_error: "Tier to unlock is required",
        invalid_type_error: "Tier must be SIMULATE, OIL_INVESTOR or PRO",
    }),
});
export type CreateCheckoutBody = z.infer<typeof CreateCheckoutBodySchema>;

export const CheckoutResponseSchema = z.object({
    checkoutUrl: z.string().url(),
    sessionId: z.string(),
    externalId: z.string(),
});
export type CheckoutResponse = z.infer<typeof CheckoutResponseSchema>;

// ============================================================================
// 2. PORTAL SCHEMAS (Stripe Customer Portal)
// ============================================================================
export const PortalResponseSchema = z.object({
    portalUrl: z.string().url(),
});
export type PortalResponse = z.infer<typeof PortalResponseSchema>;

// ============================================================================
// 3. CHECKOUT SESSION VERIFICATION (success page)
// ============================================================================
export const VerifyCheckoutSessionBodySchema = z.object({
    sessionId: z
        .string()
        .min(1, "Session id is required")
        .regex(/^cs_/, "Invalid Stripe session id"),
});
export type VerifyCheckoutSessionBody = z.infer<typeof VerifyCheckoutSessionBodySchema>;

export const VerifyCheckoutSessionParamsSchema = z.object({
    sessionId: z.string(),
    tenantId: z.string(),
    logContext: z.any().optional(),
});
export type VerifyCheckoutSessionParams = z.infer<typeof VerifyCheckoutSessionParamsSchema>;

export const VerifyCheckoutSessionResponseSchema = z.object({
    valid: z.boolean().openapi({ example: true }),
    status: z
        .string()
        .openapi({ example: "paid", description: "Stripe payment_status of the session" }),
    tier: z
        .string()
        .nullable()
        .openapi({ example: "SIMULATE", description: "Tier the session unlocks (from session metadata)" }),
});
export type VerifyCheckoutSessionResponse = z.infer<typeof VerifyCheckoutSessionResponseSchema>;
