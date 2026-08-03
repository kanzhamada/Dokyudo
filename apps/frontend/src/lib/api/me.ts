import { apiRequest } from './client';
import type { ApiResult } from '../types/api.types';
import type { UserProfileResponse, UserUsageResponse } from '../types/auth.types';

export function getMe(): Promise<ApiResult<UserProfileResponse>> {
	return apiRequest<UserProfileResponse>('/api/me', { method: 'GET' });
}

export function getMeUsage(): Promise<ApiResult<UserUsageResponse>> {
	return apiRequest<UserUsageResponse>('/api/me/usage', { method: 'GET' });
}
