<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client as zodClient } from 'sveltekit-superforms/adapters';
	import { resolve } from '$app/paths';
	import { loginSchema } from '$lib/schemas/auth.schema';
	import { seo } from '$lib/seo';
	import { authLogin } from '$lib/api/auth';
	import { sessionStore } from '$lib/state/session.store.svelte';
	import { loadRecaptcha, executeRecaptcha } from '$lib/utils/recaptcha.util';
	import { PUBLIC_RECAPTCHA_SITE_KEY } from '$env/static/public';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	import AuthPasswordInput from '$lib/components/auth/AuthPasswordInput.svelte';
	import AuthOAuthGroup from '$lib/components/auth/AuthOAuthGroup.svelte';
	import AuthErrorBox from '$lib/components/auth/AuthErrorBox.svelte';
	import AuthBackButton from '$lib/components/auth/AuthBackButton.svelte';

	let { data } = $props();

	let apiError = $state('');
	let isSubmitting = $state(false);
	let lockoutEndTime = $state<number | null>(null);

	// Safe post-login redirect target — internal paths only (open-redirect guard).
	// Used by the public share page: /login?redirect=/s/{code}
	function resolveRedirectParam(): string {
		try {
			const params = new URLSearchParams(window.location.search);
			const redirect = params.get('redirect');
			if (!redirect) return '/app/chat';
			if (!redirect.startsWith('/')) return '/app/chat';
			if (redirect.startsWith('//') || redirect.startsWith('/\\')) return '/app/chat';
			if (redirect.includes('\\') || redirect.includes(':')) return '/app/chat';
			return redirect;
		} catch {
			return '/app/chat';
		}
	}
	let redirectPath = $state('/app/chat');

	// Countdown logic moved to AuthErrorBox component

	const form = superForm(data.form, {
		validators: zodClient(loginSchema),
		SPA: true,
		resetForm: false,
		onUpdate: async ({ form: f }) => {
			if (!f.valid) return;

			isSubmitting = true;
			apiError = '';

			try {
				const token = await executeRecaptcha(PUBLIC_RECAPTCHA_SITE_KEY, 'login');

				const result = await authLogin({
					email: f.data.email,
					password: f.data.password,
					recaptchaToken: token
				});

				if (result.ok) {
					sessionStore.set(result.data.user);
					localStorage.removeItem('dokyudo_login_lockout');
					/* eslint-disable-next-line svelte/no-navigation-without-resolve */
					await goto(redirectPath);
				} else {
					if (result.error.code === 'RATE_LIMIT_EXCEEDED' && result.error.retryAfter) {
						const endTime = Date.now() + result.error.retryAfter * 1000;
						localStorage.setItem('dokyudo_login_lockout', endTime.toString());
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
			}
		}
	});

	const { form: formData, enhance } = form;

	onMount(() => {
		redirectPath = resolveRedirectParam();
		loadRecaptcha(PUBLIC_RECAPTCHA_SITE_KEY);

		// Surface OAuth failures reported back by the backend callback
		// (e.g. user denied consent) as a visible error on this page.
		const oauthError = new URLSearchParams(window.location.search).get('oauth_error');
		if (oauthError) {
			apiError = decodeURIComponent(oauthError);
		}

		const storedLockout = localStorage.getItem('dokyudo_login_lockout');
		if (storedLockout) {
			const end = parseInt(storedLockout, 10);
			if (end > Date.now()) {
				lockoutEndTime = end;
			} else {
				localStorage.removeItem('dokyudo_login_lockout');
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
	<header class="auth-page-header">
		<h1 class="auth-heading">Welcome back.</h1>
	</header>

	<form method="POST" use:enhance class="auth-form">
		<Form.Field {form} name="email" class="auth-field">
			<label class="auth-field-label" for="email">Email address</label>
			<Form.Control>
				{#snippet children({ props })}
					<Input
						{...props}
						id="email"
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
			<label class="auth-field-label" for="password">Password</label>
			<Form.Control>
				{#snippet children({ props })}
					<AuthPasswordInput
						{...props}
						id="password"
						bind:value={$formData.password}
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
				Signing in...
			{:else}
				Sign in
			{/if}
		</Button>

		<div class="flex justify-end">
			<a
				href={resolve('/forget-password')}
				class="font-geist text-xs text-[#B9B9B9] underline-offset-3 hover:text-white"
			>
				Forgot password?
			</a>
		</div>

		<AuthErrorBox
			{apiError}
			bind:lockoutEndTime
			localStorageKey="dokyudo_login_lockout"
			lockoutMessage="Too many failed attempts. Try again in"
		/>
	</form>

	<AuthOAuthGroup />

	<p class="auth-footer">
		Don't have an account?
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<a {...props} href={resolve('/register')}>Register</a>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content class="bg-[#3E3E3E]" arrowClasses="bg-[#3E3E3E]"
					>Create a new account</Tooltip.Content
				>
			</Tooltip.Root>
		</Tooltip.Provider>
	</p>
</div>
