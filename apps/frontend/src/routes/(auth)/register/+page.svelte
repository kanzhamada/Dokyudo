<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client as zodClient } from 'sveltekit-superforms/adapters';
	import { registerSchema } from '$lib/schemas/auth.schema';
	import { authRegister } from '$lib/api/auth';
	import { loadRecaptcha, executeRecaptcha } from '$lib/utils/recaptcha.util';
	import { PUBLIC_RECAPTCHA_SITE_KEY } from '$env/static/public';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import { Separator } from '$lib/components/ui/separator';
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

			// Debug Log: Frontend State BEFORE hitting backend
			console.log('[Auth Register] Form Submitted:', {
				email: f.data.email,
				password: f.data.password,
				confirmPassword: f.data.confirmPassword
			});

			try {
				const token = await executeRecaptcha(PUBLIC_RECAPTCHA_SITE_KEY, 'register');

				const result = await authRegister({
					email: f.data.email,
					password: f.data.password,
					recaptchaToken: token
				});

				// Debug Log: Raw response AFTER hitting backend
				console.log('[Auth Register] Backend Response (POST /api/auth/register):', result);

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
			} catch (err: any) {
				apiError = 'Something went wrong. Please try again.';
				console.error('[Auth Register] Catch Error:', err);
			} finally {
				isSubmitting = false;
				f.data.password = '';
				f.data.confirmPassword = '';
			}
		}
	});

	const { form: formData, enhance } = form;

	import { onMount } from 'svelte';
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
	<title>{data.title} | Dokyudo</title>
	<meta name="description" content={data.description} />
</svelte:head>

<!-- Back button -->
<AuthBackButton href="/" tooltipText="Back to Home" />

{#if registrationSuccess}
	<!-- Success state -->
	<AuthSuccessState 
		heading="Check your email." 
		description="We've sent a verification link to your email address. Please verify to complete registration." 
		buttonHref="/login" 
		buttonText="Go to Sign In" 
	/>
{:else}
	<!-- Header -->
	<div class="mt-4 mb-8 md:mt-0">
		<h1 class="auth-heading">Create Account.</h1>
		<p class="auth-subheading">Join us today.</p>
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

		<!-- Confirm Password -->
		<Form.Field {form} name="confirmPassword">
			<Form.Control>
				{#snippet children({ props })}
					<AuthPasswordInput
						{...props}
						placeholder="Confirm Password"
						bind:value={$formData.confirmPassword}
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
				Creating account...
			{:else}
				Register
			{/if}
		</Button>

		<!-- Error box -->
		<AuthErrorBox {apiError} bind:lockoutEndTime localStorageKey="dokyudo_register_lockout" />
	</form>

	<AuthOAuthGroup />

	<!-- Footer link -->
	<p class="mt-6 text-center text-sm text-white" style="font-family: 'Inter Variable', sans-serif;">
		Already have an account?
		<Tooltip.Provider>
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<a
							{...props}
							href="/login"
							class="cursor-pointer font-semibold text-white underline underline-offset-2 transition-colors hover:text-[#E8DEC8]"
						>
							Sign in
						</a>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content class="bg-[#232323]" arrowClasses="bg-[#232323]">Login to your account</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
	</p>
{/if}
