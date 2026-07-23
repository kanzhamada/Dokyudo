<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { sessionStore } from '$lib/state/session.store.svelte';

	let errorMessage = $state('');
	let dots = $state('');

	onMount(async () => {
		const urlParams = new URLSearchParams(window.location.search);

		console.log('[Auth OAuth Callback] URL params received.');

		if (urlParams.has('error')) {
			errorMessage = urlParams.get('error') || 'An error occurred during authentication.';
			console.error('[Auth OAuth Callback] Error from backend:', errorMessage);
			return;
		}

		const accessToken = urlParams.get('access_token');
		const refreshToken = urlParams.get('refresh_token');

		if (!accessToken || !refreshToken) {
			errorMessage = 'Missing authentication tokens. Please try again.';
			console.error('[Auth OAuth Callback] Missing tokens in URL params.');
			return;
		}

		try {
			// Decode the JWT payload to extract user info (no network call needed)
			const payloadBase64 = accessToken.split('.')[1];
			const payload = JSON.parse(atob(payloadBase64));

			console.log('[Auth OAuth Callback] Session established for user:', payload.sub);

			sessionStore.set({
				accessToken,
				refreshToken,
				user: {
					id: payload.sub,
					email: payload.email ?? ''
				}
			});

			await goto('/app/chat');
		} catch (err: any) {
			errorMessage = 'Failed to process authentication. Please try again.';
			console.error('[Auth OAuth Callback] Token parsing error:', err);
		}
	});

	$effect(() => {
		if (!errorMessage) {
			const interval = setInterval(() => {
				dots = dots.length >= 3 ? '' : dots + '.';
			}, 400);
			return () => clearInterval(interval);
		}
	});
</script>

<svelte:head>
	<title>Authenticating | Dokyudo</title>
</svelte:head>

<div class="flex flex-col items-center justify-center py-12">
	{#if errorMessage}
		<!-- Error State -->
		<div class="flex h-16 w-16 items-center justify-center rounded-full bg-[#FB6363]/10 mb-6">
			<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FB6363" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
		</div>
		<h1 class="auth-heading text-3xl md:text-4xl text-center">Authentication Failed</h1>
		<p class="auth-subheading text-white/80 text-center mt-2 max-w-sm">
			{errorMessage}
		</p>
		<a href="/login" class="auth-btn-primary w-full max-w-xs mt-8 text-center block"> Back to Sign In </a>
	{:else}
		<!-- Loading State -->
		<h1 class="auth-heading text-3xl md:text-4xl text-center mt-6">
			Authenticating<span class="inline-block w-8 text-left">{dots}</span>
		</h1>
		<p class="auth-subheading text-white/80 text-center mt-2">
			Please wait while we complete your sign in.
		</p>
	{/if}
</div>
