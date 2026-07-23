<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client as zodClient } from 'sveltekit-superforms/adapters';
	import { forgotPasswordSchema } from '$lib/schemas/auth.schema';
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

			console.log('[Auth Forgot Password] Form Submitted:', { email: f.data.email });

			try {
				const token = await executeRecaptcha(PUBLIC_RECAPTCHA_SITE_KEY, 'forgot_password');
				const result = await authForgotPassword({ email: f.data.email, recaptchaToken: token });

				console.log('[Auth Forgot Password] Backend Response:', result);
				localStorage.setItem('dokyudo_reset_email', f.data.email);

				// Always show success to prevent email enumeration — backend does the same
				successMessage = 'If an account exists, a reset link has been sent to that email.';
			} catch (err: any) {
				apiError = 'Something went wrong. Please try again.';
				console.error('[Auth Forgot Password] Catch Error:', err);
			} finally {
				isSubmitting = false;
			}
		}
	});

	const { form: formData, enhance } = form;

	onMount(() => loadRecaptcha(PUBLIC_RECAPTCHA_SITE_KEY));
</script>

<svelte:head>
	<title>{data.title} | Dokyudo</title>
	<meta name="description" content={data.description} />
</svelte:head>

<!-- Back button -->
<AuthBackButton href="/login" tooltipText="Back to Sign In" />

{#if successMessage}
	<!-- Success state -->
	<AuthSuccessState
		heading="Check your email."
		description={successMessage}
		buttonHref="/login"
		buttonText="Back to Sign In"
	/>
{:else}
	<!-- Header -->
	<div class="mt-4 mb-8 md:mt-0">
		<h1 class="auth-heading">Reset Password.</h1>
		<p class="auth-subheading">Enter your email to receive a reset link.</p>
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
						autofocus
						disabled={isSubmitting}
						bind:value={$formData.email}
						variant="auth"
						class="auth-input"
					/>
				{/snippet}
			</Form.Control>
			<Form.FieldErrors class="text-xs text-[#FB6363]" />
		</Form.Field>

		<!-- Submit button -->
		<Button
			type="submit"
			disabled={isSubmitting}
			variant="authPrimary"
			class="auth-btn-primary mt-2"
		>
			{#if isSubmitting}
				<Spinner class="mr-2 size-4" />
				Sending link...
			{:else}
				Send Reset Link
			{/if}
		</Button>

		<!-- Error box -->
		<AuthErrorBox {apiError} />
	</form>

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
				<Tooltip.Content class="bg-[#232323]" arrowClasses="bg-[#232323]"
					>Login to your account</Tooltip.Content
				>
			</Tooltip.Root>
		</Tooltip.Provider>
	</p>
{/if}
