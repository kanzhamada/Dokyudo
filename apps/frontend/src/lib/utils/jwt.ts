export interface JwtPayload {
	exp?: number;
	sub?: string;
	email?: string;
	[key: string]: unknown;
}

/** Decodes the payload of a JWT (base64url) without verifying the signature. */
export function decodeJwt(token: string): JwtPayload | null {
	try {
		const parts = token.split('.');
		if (parts.length < 2) return null;

		const base64Url = parts[1];
		const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
		const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

		const jsonPayload = decodeURIComponent(
			atob(padded)
				.split('')
				.map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
				.join('')
		);

		return JSON.parse(jsonPayload) as JwtPayload;
	} catch {
		return null;
	}
}

/** Returns true when the token has no valid `exp` claim in the future (with optional leeway in ms). */
export function isJwtExpired(token: string, leewayMs = 0): boolean {
	const payload = decodeJwt(token);
	if (!payload?.exp) return false;
	return payload.exp * 1000 <= Date.now() + leewayMs;
}
