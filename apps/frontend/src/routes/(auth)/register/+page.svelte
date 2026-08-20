<script lang="ts">
	import { onMount } from 'svelte';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client as zodClient } from 'sveltekit-superforms/adapters';
	import { resolve } from '$app/paths';
	import { registerSchema } from '$lib/schemas/auth.schema';
	import { seo } from '$lib/seo';
	import { authRegister } from '$lib/api/auth';
	import { loadRecaptcha, executeRecaptcha } from '$lib/utils/recaptcha.util';
	import { PUBLIC_RECAPTCHA_SITE_KEY } from '$env/static/public';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import * as Tooltip from '$lib/components/ui/tooltip';

	import AuthPasswordInput from '$lib/components/auth/AuthPasswordInput.svelte';
	import AuthOAuthGroup from '$lib/components/auth/AuthOAuthGroup.svelte';
	import AuthErrorBox from '$lib/components/auth/AuthErrorBox.svelte';
	import AuthSuccessState from '$lib/components/auth/AuthSuccessState.svelte';
	import AuthBackButton from '$lib/components/auth/AuthBackButton.svelte';

	let { data } = $props();

	let apiError = $state('');
	let isSubmitting = $state(false);
	let registrationSuccess = $state(false);

	let lockoutEndTime = $state<number | null>(null);

	// Countdown logic moved to AuthErrorBox component

	const form = superForm(data.form, {
		validators: zodClient(registerSchema),
		SPA: true,
		resetForm: false,
		onUpdate: async ({ form: f }) => {
			if (!f.valid) return;

			isSubmitting = true;
			apiError = '';

			try {
				const token = await executeRecaptcha(PUBLIC_RECAPTCHA_SITE_KEY, 'register');

				const result = await authRegister({
					email: f.data.email,
					password: f.data.password,
					recaptchaToken: token
				});

				if (result.ok) {
					localStorage.removeItem('dokyudo_register_lockout');
					registrationSuccess = true;
				} else {
					if (result.error.code === 'RATE_LIMIT_EXCEEDED' && result.error.retryAfter) {
						const endTime = Date.now() + result.error.retryAfter * 1000;
						localStorage.setItem('dokyudo_register_lockout', endTime.toString());
						lockoutEndTime = endTime;
					} else {
						apiError = result.error.message;
					}
				}
			} catch {
				apiError = 'Something went wrong. Please try again.';
			} finally {
				isSubmitting = false;
				f.data.password = '';
				f.data.confirmPassword = '';
			}
		}
	});

	const { form: formData, enhance } = form;

	onMount(() => {
		loadRecaptcha(PUBLIC_RECAPTCHA_SITE_KEY);

		const storedLockout = localStorage.getItem('dokyudo_register_lockout');
		if (storedLockout) {
			const end = parseInt(storedLockout, 10);
			if (end > Date.now()) {
				lockoutEndTime = end;
			} else {
				localStorage.removeItem('dokyudo_register_lockout');
			}
		}
	});
</script>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html seo({ title: `${data.title} | Dokyudo`, description: data.description })}
</svelte:head>

<AuthBackButton href="/" tooltipText="Back to Home" />

<div class="auth-page-content">
	{#if registrationSuccess}
		<AuthSuccessState heading="Check your email." buttonHref="/login" buttonText="Go to sign in" />
	{:else}
		<header class="auth-page-header">
			<h1 class="auth-heading">Create your account.</h1>
		</header>

		<form method="POST" use:enhance class="auth-form">
			<Form.Field {form} name="email" class="auth-field">
				<label class="auth-field-label" for="register-email">Email address</label>
				<Form.Control>
					{#snippet children({ props })}
						<Input
							{...props}
							id="register-email"
							type="email"
							placeholder="you@company.com"
							autofocus={lockoutEndTime === null}
							disabled={isSubmitting || lockoutEndTime !== null}
							bind:value={$formData.email}
							variant="auth"
							class="auth-input"
						/>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors class="auth-field-error" />
			</Form.Field>

			<Form.Field {form} name="password" class="auth-field">
				<label class="auth-field-label" for="register-password">Password</label>
				<Form.Control>
					{#snippet children({ props })}
						<AuthPasswordInput
							{...props}
							id="register-password"
							bind:value={$formData.password}
							disabled={isSubmitting || lockoutEndTime !== null}
						/>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors class="auth-field-error" />
			</Form.Field>

			<Form.Field {form} name="confirmPassword" class="auth-field">
				<label class="auth-field-label" for="confirm-password">Confirm password</label>
				<Form.Control>
					{#snippet children({ props })}
						<AuthPasswordInput
							{...props}
							id="confirm-password"
							placeholder="Re-enter your password"
							bind:value={$formData.confirmPassword}
							disabled={isSubmitting || lockoutEndTime !== null}
						/>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors class="auth-field-error" />
			</Form.Field>

			<Button
				type="submit"
				disabled={isSubmitting || lockoutEndTime !== null}
				variant="authPrimary"
				class="auth-btn-primary"
			>
				{#if isSubmitting}
					<Spinner class="mr-2 size-4" />
					Creating account...
				{:else}
					Create account
				{/if}
			</Button>

			<AuthErrorBox {apiError} bind:lockoutEndTime localStorageKey="dokyudo_register_lockout" />
		</form>

		<AuthOAuthGroup />

		<p class="auth-footer">
			Already have an account?
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
