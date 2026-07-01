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
    sessionId: z.string(),
    externalId: z.string(),
});
export type CheckoutResponse = z.infer<typeof CheckoutResponseSchema>;
