import { superValidate } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';
import { registerSchema } from '$lib/schemas/auth.schema';
import type { PageLoad } from '../register/$types';

export const load: PageLoad = async () => {
	return {
		form: await superValidate(zod(registerSchema)),
		title: 'Register',
		description: 'Create your Dokyudo account'
	};
};
