<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { authVerifyEmail } from '$lib/api/auth';
	import { sessionStore } from '$lib/state/session.store.svelte';
	import { Spinner } from '$lib/components/ui/spinner';
	import AuthBackButton from '$lib/components/auth/AuthBackButton.svelte';

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

		console.log('[Auth Verify] Verifying token_hash...');

		try {
			const result = await authVerifyEmail({ tokenHash, type });
			console.log('[Auth Verify] Backend Response:', result);

			if (result.ok) {
				sessionStore.set(result.data);
				localStorage.removeItem('dokyudo_register_lockout');
				await goto('/app/chat');
			} else {
				errorMessage = result.error.message || 'Verification link is invalid or has expired.';
			}
		} catch (err: any) {
			errorMessage = 'An error occurred while verifying your email. Please try again.';
			console.error('[Auth Verify] Error:', err);
		} finally {
			isVerifying = false;
		}
	});
</script>

<svelte:head>
	<title>Verifying Email | Dokyudo</title>
</svelte:head>

<AuthBackButton href="/login" tooltipText="Back to Sign In" />

<div class="flex flex-col items-center justify-center py-12">
	{#if isVerifying}
		<Spinner class="mb-4 size-10 text-white" />
		<h1 class="auth-heading text-center text-3xl md:text-4xl">Verifying Email...</h1>
		<p class="auth-subheading mt-2 text-center text-white/80">
			Please wait while we activate your account.
		</p>
	{:else if errorMessage}
		<div class="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#FB6363]/10">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="32"
				height="32"
				viewBox="0 0 24 24"
				fill="none"
				stroke="#FB6363"
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
		<h1 class="auth-heading text-center text-3xl md:text-4xl">Verification Failed</h1>
		<p class="auth-subheading mt-2 max-w-sm text-center text-white/80">
			{errorMessage}
		</p>
		<a href="/login" class="auth-btn-primary mt-8 block w-full max-w-xs text-center">
			Back to Sign In
		</a>
	{/if}
</div>
