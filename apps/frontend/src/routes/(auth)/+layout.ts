import { browser } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { isJwtExpired } from '$lib/utils/jwt';

const SESSION_KEY = 'dokyudo_session';

export const load: LayoutLoad = () => {
	if (!browser) return;

	const sessionRaw = localStorage.getItem(SESSION_KEY);
	if (!sessionRaw) return;

	let session: { accessToken?: string };
	try {
		session = JSON.parse(sessionRaw);
	} catch {
		return;
	}

	const token = session?.accessToken;
	if (!token) return;

	// Never touch the stored JWT here — it stays in localStorage until the user
	// explicitly destroys the session (logout / session-expired dialog).
	// While the token is still valid, bounce the user back into /app.
	if (!isJwtExpired(token)) {
		redirect(307, '/app/chat');
	}
};
