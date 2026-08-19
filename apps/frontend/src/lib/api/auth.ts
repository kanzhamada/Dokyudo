import { apiRequest } from './client';
import type { ApiResult } from '../types/api.types';
import type {
	LoginResponse,
	RegisterResponse,
	LogoutResponse,
	ForgotPasswordResponse,
	ResetPasswordResponse,
	VerifyEmailResponse,
	SessionResponse,
	LoginRequestPayload,
	RegisterRequestPayload,
	ForgotPasswordRequestPayload,
	ResetPasswordRequestPayload,
	VerifyEmailRequestPayload
} from '../types/auth.types';

/** Hydrates the current auth state from the httpOnly session cookies. */
export function getSession(): Promise<ApiResult<SessionResponse>> {
	return apiRequest<SessionResponse>('/api/auth/session', { method: 'GET' });
}

export function authLogin(params: LoginRequestPayload): Promise<ApiResult<LoginResponse>> {
	return apiRequest<LoginResponse>('/api/auth/login', { method: 'POST', body: params });
}

export function authRegister(params: RegisterRequestPayload): Promise<ApiResult<RegisterResponse>> {
	return apiRequest<RegisterResponse>('/api/auth/register', { method: 'POST', body: params });
}

export function authLogout(): Promise<ApiResult<LogoutResponse>> {
	return apiRequest<LogoutResponse>('/api/auth/logout', { method: 'POST' });
}

export function authForgotPassword(
	params: ForgotPasswordRequestPayload
): Promise<ApiResult<ForgotPasswordResponse>> {
	return apiRequest<ForgotPasswordResponse>('/api/auth/forget-password', {
		method: 'POST',
		body: params
	});
}

export function authResetPassword(
	params: ResetPasswordRequestPayload
): Promise<ApiResult<ResetPasswordResponse>> {
	return apiRequest<ResetPasswordResponse>('/api/auth/reset-password', {
		method: 'POST',
		body: params
	});
}

export function authVerifyEmail(
	params: VerifyEmailRequestPayload
): Promise<ApiResult<VerifyEmailResponse>> {
	return apiRequest<VerifyEmailResponse>('/api/auth/verify-email', {
		method: 'POST',
		body: params
	});
}

export { updatePassword as authUpdatePassword, updateTenantName as authUpdateTenantName } from './me';
export { initiateGoogleOAuth, initiateGithubOAuth } from './oauth';
