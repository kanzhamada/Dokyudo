<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client as zodClient } from 'sveltekit-superforms/adapters';
	import { updatePasswordSchema } from '$lib/schemas/auth.schema';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import * as Tooltip from '$lib/components/ui/tooltip';

	import AuthPasswordInput from '$lib/components/auth/AuthPasswordInput.svelte';
	import AuthSuccessState from '$lib/components/auth/AuthSuccessState.svelte';
	import AuthBackButton from '$lib/components/auth/AuthBackButton.svelte';

	let { data } = $props();

	let isSubmitting = $state(false);
	let successMessage = $state('');

	const form = superForm(data.form, {
		validators: zodClient(updatePasswordSchema),
		SPA: true,
		resetForm: false,
		onUpdate: async ({ form: f }) => {
			if (!f.valid) return;
			isSubmitting = true;

			// Simulate API call for now (just frontend implementation as requested)
			await new Promise(r => setTimeout(r, 1000));
			
			successMessage = 'Your password has been successfully updated.';
			isSubmitting = false;
		}
	});

	const { form: formData, enhance } = form;
</script>

<svelte:head>
	<title>{data.title} | Dokyudo</title>
	<meta name="description" content={data.description} />
</svelte:head>

<!-- Back button (Disabled during success state so they just click the primary button) -->
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
	<div class="mt-4 mb-8 md:mt-0">
		<h1 class="auth-heading">New Password.</h1>
		<p class="auth-subheading">Enter a new secure password below.</p>
	</div>

	<!-- Form -->
	<form method="POST" use:enhance class="flex flex-col gap-3">
		<!-- Password -->
		<Form.Field {form} name="password">
			<Form.Control>
				{#snippet children({ props })}
					<AuthPasswordInput
						{...props}
						placeholder="New Password"
						autofocus
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
		<Button type="submit" disabled={isSubmitting} variant="authPrimary" class="auth-btn-primary mt-2">
			{#if isSubmitting}
				<Spinner class="mr-2 size-4" />
				Updating...
			{:else}
				Update Password
			{/if}
		</Button>
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
				<Tooltip.Content class="bg-[#232323]" arrowClasses="bg-[#232323]">Login to your account</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
	</p>
{/if}
