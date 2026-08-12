import { apiRequest } from './client';
import type { ApiResult } from '../types/api.types';
import type { BillingPortalResponse } from '../types/payments.types';

export function createBillingPortalSession(): Promise<ApiResult<BillingPortalResponse>> {
	return apiRequest<BillingPortalResponse>('/api/payments/portal', { method: 'POST' });
}
