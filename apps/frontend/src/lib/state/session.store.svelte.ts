const SESSION_KEY = 'dokyudo_session';

interface SessionData {
	accessToken: string;
	refreshToken: string;
	user: { id: string; email: string };
}

function createSessionStore() {
	const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(SESSION_KEY) : null;

	let session = $state<SessionData | null>(stored ? JSON.parse(stored) : null);

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
		},
		getAccessToken(): string | null {
			return session?.accessToken ?? null;
		}
	};
}

export const sessionStore = createSessionStore();
