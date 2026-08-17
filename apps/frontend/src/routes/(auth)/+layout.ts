import { browser } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { sessionStore } from '$lib/state/session.store.svelte';

export const load: LayoutLoad = async () => {
	if (!browser) return;

	// The session lives in httpOnly cookies, so the only way to know whether
	// the user is signed in is to ask the API. While a valid session exists,
	// keep the user inside /app — they only leave after a deliberate logout.
	const authenticated = await sessionStore.hydrate();
	if (authenticated) {
		redirect(307, '/app/chat');
	}
};
