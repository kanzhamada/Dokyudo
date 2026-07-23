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
