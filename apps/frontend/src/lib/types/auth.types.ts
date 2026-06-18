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
