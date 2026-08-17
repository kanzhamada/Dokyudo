import { apiRequest } from './client';
import type { ApiResult } from '../types/api.types';
import type {
	LoginResponse,
	RegisterResponse,
	LogoutResponse,
	ForgotPasswordResponse,
	ResetPasswordResponse,
	UpdatePasswordResponse,
	UpdateTenantNameResponse,
	VerifyEmailResponse,
	SessionResponse,
	LoginRequestPayload,
	RegisterRequestPayload,
	ForgotPasswordRequestPayload,
	ResetPasswordRequestPayload,
	UpdatePasswordRequestPayload,
	UpdateTenantNameRequestPayload,
	VerifyEmailRequestPayload
} from '../types/auth.types';
import { PUBLIC_API_URL } from '$env/static/public';

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

export function authUpdatePassword(
	params: UpdatePasswordRequestPayload
): Promise<ApiResult<UpdatePasswordResponse>> {
	return apiRequest<UpdatePasswordResponse>('/api/auth/update-password', {
		method: 'PUT',
		body: params
	});
}

export function authUpdateTenantName(
	params: UpdateTenantNameRequestPayload
): Promise<ApiResult<UpdateTenantNameResponse>> {
	return apiRequest<UpdateTenantNameResponse>('/api/auth/tenant/name', {
		method: 'PATCH',
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

/** Initiates the Google OAuth flow via a full-page redirect. */
export function initiateGoogleOAuth(): void {
	const url = `${PUBLIC_API_URL}/api/auth/oauth/google`;
	console.log(`[OAuthDebug] Initiating Google OAuth -> ${url}`);
	window.location.href = url;
}

/** Initiates the GitHub OAuth flow via a full-page redirect. */
export function initiateGithubOAuth(): void {
	const url = `${PUBLIC_API_URL}/api/auth/oauth/github`;
	console.log(`[OAuthDebug] Initiating GitHub OAuth -> ${url}`);
	window.location.href = url;
}
