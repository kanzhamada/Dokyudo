import { superValidate } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';
import { loginSchema } from '$lib/schemas/auth.schema';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	return {
		form: await superValidate(zod(loginSchema)),
		title: 'Sign In',
		description: 'Sign in to your Dokyudo account'
	};
};
