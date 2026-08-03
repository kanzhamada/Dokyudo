import { apiRequest } from './client';
import type { ApiResult } from '../types/api.types';
import type {
	LoginResponse,
	RegisterResponse,
	LogoutResponse,
	ForgotPasswordResponse,
	ResetPasswordResponse,
	UpdatePasswordResponse,
	VerifyEmailResponse,
	UserProfileResponse,
	LoginRequestPayload,
	RegisterRequestPayload,
	ForgotPasswordRequestPayload,
	ResetPasswordRequestPayload,
	UpdatePasswordRequestPayload,
	VerifyEmailRequestPayload
} from '../types/auth.types';
import { PUBLIC_API_URL } from '$env/static/public';

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
	window.location.href = `${PUBLIC_API_URL}/api/auth/oauth/google`;
}

/** Initiates the GitHub OAuth flow via a full-page redirect. */
export function initiateGithubOAuth(): void {
	window.location.href = `${PUBLIC_API_URL}/api/auth/oauth/github`;
}
