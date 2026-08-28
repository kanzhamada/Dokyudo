<script lang="ts">
	import { onMount } from 'svelte';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client as zodClient } from 'sveltekit-superforms/adapters';
	import { resolve } from '$app/paths';
	import { updatePasswordSchema } from '$lib/schemas/auth.schema';
	import { seo } from '$lib/seo';
	import { authResetPassword } from '$lib/api/auth';
	import * as Form from '$lib/components/ui/form';
	import * as InputOTP from '$lib/components/ui/input-otp';
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import * as Tooltip from '$lib/components/ui/tooltip';

	import AuthPasswordInput from '$lib/components/auth/AuthPasswordInput.svelte';
	import AuthSuccessState from '$lib/components/auth/AuthSuccessState.svelte';
	import AuthBackButton from '$lib/components/auth/AuthBackButton.svelte';
	import AuthErrorBox from '$lib/components/auth/AuthErrorBox.svelte';

	let { data } = $props();

	let isSubmitting = $state(false);
	let successMessage = $state('');
	let apiError = $state('');

	const form = superForm(data.form, {
		validators: zodClient(updatePasswordSchema),
		SPA: true,
		resetForm: false,
		onUpdate: async ({ form: f }) => {
			if (!f.valid) return;
			isSubmitting = true;
			apiError = '';

			console.log('[Auth Update Password] Form Submitted:', {
				email: f.data.email,
				otp: f.data.otp,
				password: f.data.password
			});

			try {
				const result = await authResetPassword({
					email: f.data.email,
					otp: f.data.otp,
					newPassword: f.data.password
				});

				console.log('[Auth Update Password] Backend Response:', result);

				if (result.ok) {
					successMessage = 'Your password has been successfully updated.';
					localStorage.removeItem('dokyudo_reset_email');
					f.data.password = '';
					f.data.confirmPassword = '';
					f.data.otp = '';
				} else {
					apiError = result.error.message;
				}
			} catch (err) {
				console.log('[Auth Update Password] Catch Error:', err);
				apiError = 'Something went wrong. Please try again.';
			} finally {
				isSubmitting = false;
				// NOTE: Do NOT clear inputs on error per user design requirement!
			}
		}
	});

	const { form: formData, errors, enhance } = form;

	onMount(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const otpParam =
			urlParams.get('otp') ||
			urlParams.get('code') ||
			urlParams.get('token_hash') ||
			urlParams.get('token');
		const emailParam = urlParams.get('email') || localStorage.getItem('dokyudo_reset_email') || '';

		if (otpParam) {
			$formData.otp = otpParam;
		}
		if (emailParam) {
			$formData.email = emailParam;
		}
	});
</script>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html seo({ title: `${data.title} | Dokyudo`, description: data.description })}
</svelte:head>

{#if !successMessage}
	<AuthBackButton href="/login" tooltipText="Back to Sign In" />
{/if}

<div class="auth-page-content">
	{#if successMessage}
		<AuthSuccessState
			heading="Password updated."
			buttonHref="/login"
			buttonText="Continue to sign in"
		/>
	{:else}
		<header class="auth-page-header">
			<h1 class="auth-heading">Choose a new password.</h1>
		</header>

		<form method="POST" use:enhance class="auth-form">
			<input type="hidden" name="email" bind:value={$formData.email} />

			<Form.Field {form} name="otp" class="auth-field">
				<label class="auth-field-label" for="reset-otp">Verification code</label>
				<Form.Control>
					{#snippet children({ props })}
						<InputOTP.Root
							{...props}
							id="reset-otp"
							maxlength={8}
							disabled={isSubmitting}
							autofocus={true}
							class="w-max"
							bind:value={$formData.otp}
						>
							{#snippet children({ cells })}
								<div
									class="auth-otp-shell relative"
									aria-invalid={$errors.otp ? 'true' : undefined}
								>
									<InputOTP.Group>
										{#each cells as cell, i (i)}
											<InputOTP.Slot {cell} class="auth-otp-slot" />
										{/each}
									</InputOTP.Group>

									<div class="pointer-events-none absolute inset-0 flex">
										{#each cells as cell, index (index)}
											<div class="auth-otp-placeholder flex items-center justify-center">
												{#if !cell.char && '01234567'[index]}
													{'01234567'[index]}
												{/if}
											</div>
										{/each}
									</div>
								</div>
							{/snippet}
						</InputOTP.Root>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors class="auth-field-error" />
			</Form.Field>

			<Form.Field {form} name="password" class="auth-field">
				<label class="auth-field-label" for="new-password">New password</label>
				<Form.Control>
					{#snippet children({ props })}
						<AuthPasswordInput
							{...props}
							id="new-password"
							placeholder="Enter a new password"
							disabled={isSubmitting}
							bind:value={$formData.password}
						/>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors class="auth-field-error" />
			</Form.Field>

			<Form.Field {form} name="confirmPassword" class="auth-field">
				<label class="auth-field-label" for="confirm-new-password">Confirm new password</label>
				<Form.Control>
					{#snippet children({ props })}
						<AuthPasswordInput
							{...props}
							id="confirm-new-password"
							placeholder="Re-enter your new password"
							disabled={isSubmitting}
							bind:value={$formData.confirmPassword}
						/>
					{/snippet}
				</Form.Control>
				<Form.FieldErrors class="auth-field-error" />
			</Form.Field>

			<Button type="submit" disabled={isSubmitting} variant="authPrimary" class="auth-btn-primary">
				{#if isSubmitting}
					<Spinner class="mr-2 size-4" />
					Updating...
				{:else}
					Update password
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
