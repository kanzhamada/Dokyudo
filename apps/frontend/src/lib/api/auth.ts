import { apiRequest } from './client';
import type { ApiResult } from '../types/api.types';
import type { LoginResponse, RegisterResponse, LoginRequestPayload, RegisterRequestPayload } from '../types/auth.types';

export function authLogin(params: LoginRequestPayload): Promise<ApiResult<LoginResponse>> {
	return apiRequest<LoginResponse>('/api/auth/login', {
		method: 'POST',
		body: params
	});
}

export function authRegister(params: RegisterRequestPayload): Promise<ApiResult<RegisterResponse>> {
	return apiRequest<RegisterResponse>('/api/auth/register', {
		method: 'POST',
		body: params
	});
}
