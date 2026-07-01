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
