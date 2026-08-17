import { isJwtExpired } from '$lib/utils/jwt';
import { sessionExpiryStore } from '$lib/state/session-expiry.store.svelte';

const SESSION_KEY = 'dokyudo_session';

interface SessionData {
	accessToken: string;
	refreshToken: string;
	user: { id: string; email: string };
}

function createSessionStore() {
	const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(SESSION_KEY) : null;

	let session = $state<SessionData | null>(null);
	if (stored) {
		try {
			session = JSON.parse(stored);
		} catch {
			// Corrupt session data — treat as no session without touching storage.
		}
	}

	return {
		get value() {
			return session;
		},
		set(data: SessionData) {
			session = data;
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem(SESSION_KEY, JSON.stringify(data));
			}
		},
		clear() {
			session = null;
			if (typeof localStorage !== 'undefined') {
				localStorage.removeItem(SESSION_KEY);
			}
			sessionExpiryStore.clear();
		},
		getAccessToken(): string | null {
			return session?.accessToken ?? null;
		},
		isExpired(): boolean {
			return session ? isJwtExpired(session.accessToken) : true;
		},
		hasValidSession(): boolean {
			return !!session && !isJwtExpired(session.accessToken);
		}
	};
}

export const sessionStore = createSessionStore();
