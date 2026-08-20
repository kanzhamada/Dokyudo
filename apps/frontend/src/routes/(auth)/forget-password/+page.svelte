<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client as zodClient } from 'sveltekit-superforms/adapters';
	import { resolve } from '$app/paths';
	import { forgotPasswordSchema } from '$lib/schemas/auth.schema';
	import { seo } from '$lib/seo';
	import { authForgotPassword } from '$lib/api/auth';
	import { loadRecaptcha, executeRecaptcha } from '$lib/utils/recaptcha.util';
	import { PUBLIC_RECAPTCHA_SITE_KEY } from '$env/static/public';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { onMount } from 'svelte';

	import AuthSuccessState from '$lib/components/auth/AuthSuccessState.svelte';
	import AuthBackButton from '$lib/components/auth/AuthBackButton.svelte';
	import AuthErrorBox from '$lib/components/auth/AuthErrorBox.svelte';

	let { data } = $props();

	let isSubmitting = $state(false);
	let successMessage = $state('');
	let apiError = $state('');

	const form = superForm(data.form, {
		validators: zodClient(forgotPasswordSchema),
		SPA: true,
		resetForm: false,
		onUpdate: async ({ form: f }) => {
			if (!f.valid) return;
			isSubmitting = true;
			apiError = '';

			try {
				const token = await executeRecaptcha(PUBLIC_RECAPTCHA_SITE_KEY, 'forgot_password');
				await authForgotPassword({ email: f.data.email, recaptchaToken: token });

				localStorage.setItem('dokyudo_reset_email', f.data.email);

				// Always show success to prevent email enumeration — backend does the same
				successMessage = 'If an account exists, a reset link has been sent to that email.';
			} catch {
				apiError = 'Something went wrong. Please try again.';
			} finally {
				isSubmitting = false;
			}
		}
	});

	const { form: formData, enhance } = form;

	onMount(() => loadRecaptcha(PUBLIC_RECAPTCHA_SITE_KEY));
</script>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html seo({ title: `${data.title} | Dokyudo`, description: data.description })}
</svelte:head>

<AuthBackButton href="/login" tooltipText="Back to Sign In" />

<div class="auth-page-content">
	{#if successMessage}
		<AuthSuccessState
			heading="Check your email."
			buttonHref="/login"
			buttonText="Back to sign in"
		/>
	{:else}
		<header class="auth-page-header">
			<h1 class="auth-heading">Reset your password.</h1>
		</header>

		<form method="POST" use:enhance class="auth-form">
			<Form.Field {form} name="email" class="auth-field">
				<label class="auth-field-label" for="reset-email">Email address</label>
				<Form.Control>
					{#snippet children({ props })}
						<Input
							{...props}
							id="reset-email"
							type="email"
							placeholder="you@company.com"
							autofocus
							disabled={isSubmitting}
							bind:value={$formData.email}
							variant="auth"
							class="auth-input"
						/>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors class="auth-field-error" />
			</Form.Field>

			<Button type="submit" disabled={isSubmitting} variant="authPrimary" class="auth-btn-primary">
				{#if isSubmitting}
					<Spinner class="mr-2 size-4" />
					Sending link...
				{:else}
					Send reset link
				{/if}
			</Button>

			<AuthErrorBox {apiError} />
		</form>

		<p class="auth-footer">
			Remember your password?
			<Tooltip.Provider>
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<a {...props} href={resolve('/login')}>Sign in</a>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content class="bg-[#3E3E3E]" arrowClasses="bg-[#3E3E3E]"
						>Login to your account</Tooltip.Content
					>
				</Tooltip.Root>
			</Tooltip.Provider>
		</p>
	{/if}
</div>
