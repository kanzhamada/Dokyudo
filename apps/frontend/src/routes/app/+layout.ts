import { browser } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = () => {
	if (browser) {
		const session = localStorage.getItem('dokyudo_session');
		if (!session) {
			redirect(307, '/login');
		}
	}
};
