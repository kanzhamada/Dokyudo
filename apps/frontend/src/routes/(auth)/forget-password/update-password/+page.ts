import { superValidate } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';
import { updatePasswordSchema } from '$lib/schemas/auth.schema';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const form = await superValidate(zod(updatePasswordSchema));

	return {
		form,
		title: 'Update Password',
		description: 'Set a new secure password for your account'
	};
};
