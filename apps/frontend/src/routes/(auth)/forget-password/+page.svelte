<script lang="ts">
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client as zodClient } from 'sveltekit-superforms/adapters';
	import { forgotPasswordSchema } from '$lib/schemas/auth.schema';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import * as Tooltip from '$lib/components/ui/tooltip';

	let { data } = $props();

	let isSubmitting = $state(false);
	let successMessage = $state('');

	const form = superForm(data.form, {
		validators: zodClient(forgotPasswordSchema),
		SPA: true,
		resetForm: false,
		onUpdate: async ({ form: f }) => {
			if (!f.valid) return;
			isSubmitting = true;

			// Simulate API call for now (just frontend implementation as requested)
			await new Promise(r => setTimeout(r, 1000));
			
			successMessage = 'If an account exists, a reset link has been sent to that email.';
			isSubmitting = false;
		}
	});

	const { form: formData, enhance } = form;
</script>

<svelte:head>
	<title>{data.title} | Dokyudo</title>
	<meta name="description" content={data.description} />
</svelte:head>

{#if successMessage}
	<!-- Success state -->
	<div class="mt-4 flex flex-col items-center gap-4 md:mt-0">
		<div class="flex h-16 w-16 items-center justify-center rounded-full bg-[#E8DEC8]/10">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="32"
				height="32"
				viewBox="0 0 24 24"
				fill="none"
				stroke="#E8DEC8"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg
			>
		</div>
		<h1 class="auth-heading text-3xl md:text-4xl text-center">Check your email.</h1>
		<p class="auth-subheading text-white/80 text-center">
			{successMessage}
		</p>
		<a href="/login" class="auth-btn-primary w-full max-w-sm mt-4 text-center block"> Back to Sign In </a>
	</div>
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
		<Button type="submit" disabled={isSubmitting} variant="authPrimary" class="auth-btn-primary mt-2">
			{#if isSubmitting}
				<Spinner class="mr-2 size-4" />
				Sending link...
			{:else}
				Send Reset Link
			{/if}
		</Button>
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
				<Tooltip.Content>Login to your account</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
	</p>
{/if}
