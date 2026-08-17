import { browser } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { sessionStore } from '$lib/state/session.store.svelte';

export const load: LayoutLoad = async () => {
	if (!browser) return;

	// Guard the protected area: only render /app/* when the httpOnly session
	// cookie resolves to a valid authenticated session.
	const authenticated = await sessionStore.hydrate();
	if (!authenticated) {
		redirect(307, '/login');
	}
};
