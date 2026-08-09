import { PUBLIC_API_URL } from '$env/static/public';
import type { PageServerLoad } from './$types';
import type { PublicShare } from '$lib/types/rag.types';

export const load: PageServerLoad = async ({ fetch, params, url }) => {
	if (!params.code) return { share: null };

	try {
		const invite = url.searchParams.get('invite');
		const query = invite ? `?invite=${encodeURIComponent(invite)}` : '';
		const response = await fetch(
			`${PUBLIC_API_URL}/api/rag/shares/${encodeURIComponent(params.code)}${query}`
		);
		if (!response.ok) return { share: null };
		return { share: (await response.json()) as PublicShare };
	} catch {
		return { share: null };
	}
};
