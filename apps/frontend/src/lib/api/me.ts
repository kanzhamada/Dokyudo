import { apiRequest } from './client';
import type { ApiResult } from '../types/api.types';
import type {
	UserProfileResponse,
	UserUsageResponse,
	DeleteAccountResponse,
	UpdatePasswordRequestPayload,
	UpdatePasswordResponse,
	UpdateTenantNameRequestPayload,
	UpdateTenantNameResponse
} from '../types/auth.types';

export function getMe(): Promise<ApiResult<UserProfileResponse>> {
	return apiRequest<UserProfileResponse>('/api/me', { method: 'GET' });
}

export function getMeUsage(): Promise<ApiResult<UserUsageResponse>> {
	return apiRequest<UserUsageResponse>('/api/me/usage', { method: 'GET' });
}

/** Schedules permanent deletion of the authenticated account (202 accepted). */
export function deleteMyAccount(): Promise<ApiResult<DeleteAccountResponse>> {
	return apiRequest<DeleteAccountResponse>('/api/me/account', { method: 'DELETE' });
}

/** Updates the password for the current authenticated user. */
export function updatePassword(
	params: UpdatePasswordRequestPayload
): Promise<ApiResult<UpdatePasswordResponse>> {
	return apiRequest<UpdatePasswordResponse>('/api/me/update-password', {
		method: 'PUT',
		body: params
	});
}

/** Updates the display name of the tenant workspace. */
export function updateTenantName(
	params: UpdateTenantNameRequestPayload
): Promise<ApiResult<UpdateTenantNameResponse>> {
	return apiRequest<UpdateTenantNameResponse>('/api/me/tenant/name', {
		method: 'PATCH',
		body: params
	});
}
