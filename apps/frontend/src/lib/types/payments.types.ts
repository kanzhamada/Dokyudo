/** Stripe Customer Portal session response */
export interface BillingPortalResponse {
	portalUrl: string;
}

/** Stripe Checkout session request */
export type CreateCheckoutRequest = {
	tierToUnlock: 'SIMULATE' | 'OIL_INVESTOR' | 'PRO';
};

/** Stripe Checkout session response */
export interface CheckoutResponse {
	checkoutUrl: string;
	sessionId: string;
	externalId: string;
}

/** Result of verifying a Stripe Checkout session on the success page */
export interface VerifyCheckoutSessionResponse {
	valid: boolean;
	status: string;
	tier: string | null;
}
