/** Login success response */
export interface LoginResponse {
	accessToken: string;
	refreshToken: string;
	user: {
		id: string;
		email: string;
	};
}

/** Register success response */
export interface RegisterResponse {
	message: string;
}

/** Logout response */
export interface LogoutResponse {
	message: string;
}

/** Forgot password request payload */
export type ForgotPasswordRequestPayload = {
	email: string;
	recaptchaToken: string;
};

/** Forgot password response */
export interface ForgotPasswordResponse {
	message: string;
}

/** Reset password (OTP path) request payload */
export type ResetPasswordRequestPayload = {
	email: string;
	otp: string;
	newPassword: string;
};

/** Reset password response */
export interface ResetPasswordResponse {
	message: string;
}

/** Update password (Bearer token path) request payload */
export type UpdatePasswordRequestPayload = {
	newPassword: string;
};

/** Update password response */
export interface UpdatePasswordResponse {
	message: string;
}

/** Update tenant display name request payload */
export type UpdateTenantNameRequestPayload = {
	name: string;
};

/** Update tenant display name response */
export interface UpdateTenantNameResponse {
	tenant: {
		id: string;
		name: string;
	};
	message: string;
}

/** Login request payload */
export type LoginRequestPayload = {
	email: string;
	password: string;
	recaptchaToken: string;
};

/** Register request payload */
export type RegisterRequestPayload = {
	email: string;
	password: string;
	recaptchaToken: string;
};

/** Verify email request payload */
export type VerifyEmailRequestPayload = {
	tokenHash: string;
	type: string;
};

/** Verify email success response */
export interface VerifyEmailResponse {
	accessToken: string;
	refreshToken: string;
	user: {
		id: string;
		email: string;
	};
}

/** User profile (/api/auth/me) response */
export interface UserProfileResponse {
	user: {
		id: string;
		email: string;
		profilePictureUrl: string | null;
	};
	tenant: {
		id: string;
		name: string;
	};
	subscription: {
		tier: string;
		expiresAt: string | null;
	};
}

/** Realtime usage metrics (/api/me/usage) response */
export interface UserUsageResponse {
	tier: 'FREE' | 'SIMULATE' | 'OIL_INVESTOR' | 'PRO';
	expiresAt: string | null;
	uploadsCount: number;
	searchesCount: number;
	qaCount: number;
	storageUsedBytes: number;
}
