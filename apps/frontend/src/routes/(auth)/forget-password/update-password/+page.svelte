<script lang="ts">
	import { onMount } from 'svelte';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client as zodClient } from 'sveltekit-superforms/adapters';
	import { updatePasswordSchema } from '$lib/schemas/auth.schema';
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
				otp: f.data.otp
			});

			try {
				const result = await authResetPassword({
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
			} catch (err: any) {
				apiError = 'Something went wrong. Please try again.';
				console.error('[Auth Update Password] Catch Error:', err);
			} finally {
				isSubmitting = false;
				// NOTE: Do NOT clear inputs on error per user design requirement!
			}
		}
	});

	const { form: formData, enhance } = form;

	onMount(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const tokenHash =
			urlParams.get('token_hash') ||
			urlParams.get('token') ||
			urlParams.get('code') ||
			urlParams.get('otp');

		if (tokenHash) {
			$formData.otp = tokenHash;
		}
	});
</script>

<svelte:head>
	<title>{data.title} | Dokyudo</title>
	<meta name="description" content={data.description} />
</svelte:head>

<!-- Back button (hidden during success state) -->
{#if !successMessage}
	<AuthBackButton href="/login" tooltipText="Back to Sign In" />
{/if}

{#if successMessage}
	<!-- Success state -->
	<AuthSuccessState
		heading="Password Updated."
		description={successMessage}
		buttonHref="/login"
		buttonText="Continue to Sign In"
	/>
{:else}
	<!-- Header -->
	<div class="mb-8 mt-4 md:mt-0">
		<h1 class="auth-heading">New Password.</h1>
		<p class="auth-subheading">Enter the 8-digit OTP from your email and your new password.</p>
	</div>

	<!-- Form -->
	<form method="POST" use:enhance class="flex flex-col gap-4">
		<!-- 8-Digit Input OTP Component -->
		<Form.Field {form} name="otp">
			<Form.Control>
				{#snippet children({ props })}
					<div class="flex flex-col items-center gap-2">
						<InputOTP.Root
							{...props}
							maxlength={8}
							disabled={isSubmitting}
							bind:value={$formData.otp}
						>
							{#snippet children({ cells })}
								<InputOTP.Group>
								{#each cells as cell (cell)}
										<InputOTP.Slot
											{cell}
											class="h-12 w-10 border border-white/10 bg-auth-input font-sans text-base font-medium text-white  "
										/>
									{/each}
								</InputOTP.Group>
								
							{/snippet}
						</InputOTP.Root>
					</div>
				{/snippet}
			</Form.Control>
			<Form.FieldErrors class="text-center text-xs text-[#FB6363]" />
		</Form.Field>

		<!-- New Password -->
		<Form.Field {form} name="password">
			<Form.Control>
				{#snippet children({ props })}
					<AuthPasswordInput
						{...props}
						placeholder="New Password"
						disabled={isSubmitting}
						bind:value={$formData.password}
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
						placeholder="Confirm New Password"
						disabled={isSubmitting}
						bind:value={$formData.confirmPassword}
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
				Updating...
			{:else}
				Update Password
			{/if}
		</Button>

		<!-- Error box -->
		<AuthErrorBox {apiError} />
	</form>

	<!-- Footer link -->
	<p class="mt-6 text-center text-sm text-white" style="font-family: 'Inter Variable', sans-serif;">
		Remember your password?
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
