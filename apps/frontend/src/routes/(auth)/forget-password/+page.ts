import { superValidate } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';
import { forgotPasswordSchema } from '$lib/schemas/auth.schema';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const form = await superValidate(zod(forgotPasswordSchema));

	return {
		form,
		title: 'Reset Password',
		description: 'Request a password reset link for your account'
	};
};
