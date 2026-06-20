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

/** Login request payload */
export interface LoginRequestPayload {
	email: string;
	password: string;
	recaptchaToken: string;
}

/** Register request payload */
export interface RegisterRequestPayload {
	email: string;
	password: string;
	recaptchaToken: string;
}
