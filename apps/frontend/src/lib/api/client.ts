import { PUBLIC_API_URL } from '$env/static/public';
import type { ApiErrorResponse, ApiResult } from '../types/api.types';
import { dokyudoFetch } from '$lib/apiClient';
import { sessionStore } from '$lib/state/session.store.svelte';
import { sessionExpiryStore } from '$lib/state/session-expiry.store.svelte';

interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
	body?: Record<string, unknown> | FormData;
}

/**
 * Base API Client wrapper.
 * Centralizes request formatting, standard error handling, and authorization.
 * Authentication is carried by httpOnly cookies (sent automatically via
 * `credentials: 'include'` in dokyudoFetch) — no manual token handling here.
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
		const response = await dokyudoFetch(`${PUBLIC_API_URL}${path}`, fetchOptions);

		if (response.ok) {
			const data = (await response.json()) as T;
			return { ok: true, data };
		}

		const errorBody = (await response.json()) as ApiErrorResponse;

		// A 401 on an authenticated request means the session is no longer
		// valid (expired/revoked) — surface the re-login dialog.
		if (response.status === 401 && sessionStore.authenticated) {
			sessionExpiryStore.trigger();
		}

		return { ok: false, error: errorBody.error };
	} catch {
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
