<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { authVerifyEmail } from '$lib/api/auth';
	import { sessionStore } from '$lib/state/session.store.svelte';
	import { Spinner } from '$lib/components/ui/spinner';
	import AuthBackButton from '$lib/components/auth/AuthBackButton.svelte';
	import { seo } from '$lib/seo';

	let isVerifying = $state(true);
	let errorMessage = $state('');

	onMount(async () => {
		const tokenHash = page.url.searchParams.get('token_hash');
		const type = page.url.searchParams.get('type') || 'signup';

		if (!tokenHash) {
			isVerifying = false;
			errorMessage = 'Missing verification token. Please check your email link.';
			return;
		}

		try {
			const result = await authVerifyEmail({ tokenHash, type });

			if (result.ok) {
				sessionStore.set(result.data.user);
				localStorage.removeItem('dokyudo_register_lockout');
				await goto(resolve('/app/chat'));
			} else {
				errorMessage = result.error.message || 'Verification link is invalid or has expired.';
			}
		} catch {
			errorMessage = 'An error occurred while verifying your email. Please try again.';
		} finally {
			isVerifying = false;
		}
	});
</script>

<svelte:head>
	{@html seo({
		title: 'Verifying Email | Dokyudo',
		description: 'Confirming your email address to activate your Dokyudo account.'
	})}
</svelte:head>

<AuthBackButton href="/login" tooltipText="Back to Sign In" />

<div class="auth-page-content">
	{#if isVerifying}
		<div class="auth-state" role="status" aria-live="polite">
			<div class="auth-state-mark">
				<Spinner class="size-7" />
			</div>
			<h1 class="auth-heading auth-state-heading">Verifying your email.</h1>
		</div>
	{:else if errorMessage}
		<div class="auth-state">
			<div class="auth-state-mark auth-state-mark-error">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="32"
					height="32"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line
						x1="12"
						y1="16"
						x2="12.01"
						y2="16"
					/></svg
				>
			</div>
			<h1 class="auth-heading auth-state-heading">Verification failed.</h1>
			<a href="/login" class="auth-btn-primary block w-full max-w-xs text-center">Back to sign in</a
			>
		</div>
	{/if}
</div>

<style>
	:global(.auth-state-mark-error) {
		border-color: color-mix(in srgb, var(--color-auth-error) 50%, transparent);
		background: color-mix(in srgb, var(--color-auth-error) 12%, var(--color-auth-input));
		color: var(--color-auth-error);
	}
</style>
