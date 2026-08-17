import { PUBLIC_API_URL } from '$env/static/public';
import { dokyudoFetch } from '$lib/apiClient';
import { sessionExpiryStore } from '$lib/state/session-expiry.store.svelte';

export interface SessionUser {
	id: string;
	email: string;
}

interface SessionResponse {
	authenticated: boolean;
	user: SessionUser | null;
}

/**
 * Client-side auth state for the current session.
 *
 * Tokens live in httpOnly cookies (scoped to the shared registrable domain),
 * so the browser never exposes them to JS. This store only holds the resolved
 * user identity, hydrated from `GET /api/auth/session`.
 */
function createSessionStore() {
	let user = $state<SessionUser | null>(null);
	let authenticated = $state(false);
	let isHydrated = $state(false);

	async function hydrate(): Promise<boolean> {
		try {
			const response = await dokyudoFetch(`${PUBLIC_API_URL}/api/auth/session`, {
				method: 'GET'
			});
			const data = (await response.json()) as SessionResponse;

			user = data.authenticated ? data.user : null;
			authenticated = data.authenticated;
			isHydrated = true;

			if (!authenticated) {
				sessionExpiryStore.clear();
			}

			return authenticated;
		} catch {
			// Network failure — keep the current state, mark hydrated so guards
			// do not loop forever on a downed API.
			isHydrated = true;
			return authenticated;
		}
	}

	return {
		get user() {
			return user;
		},
		get authenticated() {
			return authenticated;
		},
		get isHydrated() {
			return isHydrated;
		},
		set(data: SessionUser) {
			user = data;
			authenticated = true;
			isHydrated = true;
		},
		clear() {
			user = null;
			authenticated = false;
			isHydrated = true;
			sessionExpiryStore.clear();
		},
		hydrate
	};
}

export const sessionStore = createSessionStore();
