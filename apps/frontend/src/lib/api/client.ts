import { PUBLIC_API_URL } from '$env/static/public';
import type { ApiErrorResponse, ApiResult } from '../types/api.types';

interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
	body?: Record<string, unknown> | FormData;
}

/**
 * Base API Client wrapper.
 * Centralizes request formatting, standard error handling, and authorization headers.
 */
export async function apiRequest<T>(
	path: string,
	options: ApiRequestOptions = {}
): Promise<ApiResult<T>> {
	const { body, headers, ...restOptions } = options;

	const isFormData = body instanceof FormData;
	const isJson = body && !isFormData;

	const finalHeaders = new Headers(headers);
	if (isJson && !finalHeaders.has('Content-Type')) {
		finalHeaders.set('Content-Type', 'application/json');
	}

	// In the future, this is where you would centrally attach Auth Tokens:
	// const token = getAuthToken();
	// if (token) finalHeaders.set('Authorization', `Bearer ${token}`);

	const fetchOptions: RequestInit = {
		method: options.method || 'GET',
		headers: finalHeaders,
		...restOptions
	};

	if (isJson) {
		fetchOptions.body = JSON.stringify(body);
	} else if (isFormData) {
		fetchOptions.body = body;
	}

	try {
		const response = await fetch(`${PUBLIC_API_URL}${path}`, fetchOptions);

		if (response.ok) {
			const data = (await response.json()) as T;
			return { ok: true, data };
		}

		const errorBody = (await response.json()) as ApiErrorResponse;
		return { ok: false, error: errorBody.error };
	} catch (error) {
		// Network or parsing errors
		return {
			ok: false,
			error: {
				code: 'NETWORK_ERROR',
				message: 'Failed to connect to the server.',
				requestId: 'local'
			}
		};
	}
}
