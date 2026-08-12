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
