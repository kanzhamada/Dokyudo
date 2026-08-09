<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client as zodClient } from 'sveltekit-superforms/adapters';
	import { loginSchema } from '$lib/schemas/auth.schema';
	import { authLogin } from '$lib/api/auth';
	import { sessionStore } from '$lib/state/session.store.svelte';
	import { loadRecaptcha, executeRecaptcha } from '$lib/utils/recaptcha.util';
	import { PUBLIC_RECAPTCHA_SITE_KEY } from '$env/static/public';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import { Separator } from '$lib/components/ui/separator';
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

			// Debug Log: Frontend State BEFORE hitting backend
			console.log('[Auth Login] Form Submitted:', {
				email: f.data.email,
				password: f.data.password
			});

			try {
				const token = await executeRecaptcha(PUBLIC_RECAPTCHA_SITE_KEY, 'login');

				const result = await authLogin({
					email: f.data.email,
					password: f.data.password,
					recaptchaToken: token
				});

				// Debug Log: Raw response AFTER hitting backend
				console.log('[Auth Login] Backend Response (POST /api/auth/login):', result);

				if (result.ok) {
					sessionStore.set(result.data);
					localStorage.removeItem('dokyudo_login_lockout');
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
			} catch (err: any) {
				apiError = 'Something went wrong. Please try again.';
				console.error('[Auth Login] Catch Error:', err);
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
	<title>{data.title} | Dokyudo</title>
	<meta name="description" content={data.description} />
</svelte:head>

<!-- Back button -->
<AuthBackButton href="/" tooltipText="Back to Home" />

<!-- Header -->
<div class="mt-4 mb-8 md:mt-0">
	<h1 class="auth-heading">Welcome Back.</h1>
	<p class="auth-subheading">Let's get you signed in.</p>
</div>

<!-- Form -->
<form method="POST" use:enhance class="flex flex-col gap-3">
	<!-- Email -->
	<Form.Field {form} name="email">
		<Form.Control>
			{#snippet children({ props })}
				<Input
					{...props}
					type="email"
					placeholder="Email"
					autofocus={lockoutEndTime === null}
					disabled={isSubmitting || lockoutEndTime !== null}
					bind:value={$formData.email}
					variant="auth"
					class="auth-input"
				/>
			{/snippet}
		</Form.Control>
		<Form.FieldErrors class="text-xs text-[#FB6363]" />
	</Form.Field>

	<!-- Password -->
	<Form.Field {form} name="password">
		<Form.Control>
			{#snippet children({ props })}
				<AuthPasswordInput
					{...props}
					bind:value={$formData.password}
					disabled={isSubmitting || lockoutEndTime !== null}
				/>
			{/snippet}
		</Form.Control>
		<Form.FieldErrors class="text-xs text-[#FB6363]" />
	</Form.Field>

	<!-- Submit button -->
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
			Sign In
		{/if}
	</Button>

	<!-- Forgot Password Link -->
	<div class="mt-1 mb-2 flex justify-end">
		<a
			href="/forget-password"
			class="cursor-pointer text-xs text-white/70 transition-colors hover:text-white"
		>
			Forgot Password?
		</a>
	</div>

	<!-- Error box -->
	<AuthErrorBox
		{apiError}
		bind:lockoutEndTime
		localStorageKey="dokyudo_login_lockout"
		lockoutMessage="Too many failed attempts. Try again in"
	/>
</form>

<AuthOAuthGroup />

<!-- Footer link -->
<p class="mt-6 text-center text-sm text-white" style="font-family: 'Inter Variable', sans-serif;">
	Don't have an account?
	<Tooltip.Provider>
		<Tooltip.Root>
			<Tooltip.Trigger>
				{#snippet child({ props })}
					<a
						{...props}
						href="/register"
						class="cursor-pointer font-semibold text-white underline underline-offset-2 transition-colors hover:text-[#E8DEC8]"
					>
						Register
					</a>
				{/snippet}
			</Tooltip.Trigger>
			<Tooltip.Content class="bg-[#232323]" arrowClasses="bg-[#232323]"
				>Create a new account</Tooltip.Content
			>
		</Tooltip.Root>
	</Tooltip.Provider>
</p>
