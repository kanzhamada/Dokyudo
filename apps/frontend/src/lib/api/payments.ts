import { apiRequest } from './client';
import type { ApiResult } from '../types/api.types';
import type {
	BillingPortalResponse,
	CheckoutResponse,
	CreateCheckoutRequest,
	VerifyCheckoutSessionResponse
} from '../types/payments.types';

export function createBillingPortalSession(): Promise<ApiResult<BillingPortalResponse>> {
	return apiRequest<BillingPortalResponse>('/api/payments/portal', { method: 'POST' });
}

export function createCheckoutSession(
	params: CreateCheckoutRequest
): Promise<ApiResult<CheckoutResponse>> {
	return apiRequest<CheckoutResponse>('/api/payments/checkout', {
		method: 'POST',
		body: params
	});
}

export function verifyCheckoutSession(
	sessionId: string
): Promise<ApiResult<VerifyCheckoutSessionResponse>> {
	return apiRequest<VerifyCheckoutSessionResponse>('/api/payments/checkout/verify', {
		method: 'POST',
		body: { sessionId }
	});
}
