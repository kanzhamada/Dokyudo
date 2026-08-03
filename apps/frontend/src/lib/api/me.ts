import { apiRequest } from './client';
import type { ApiResult } from '../types/api.types';
import type { UserUsageResponse } from '../types/auth.types';

export function getMeUsage(): Promise<ApiResult<UserUsageResponse>> {
	return apiRequest<UserUsageResponse>('/api/me/usage', { method: 'GET' });
}
