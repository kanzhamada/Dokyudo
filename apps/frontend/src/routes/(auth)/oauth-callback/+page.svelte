<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { sessionStore } from '$lib/state/session.store.svelte';
	import { decodeJwt } from '$lib/utils/jwt';
	import Button from '$lib/components/ui/button/button.svelte';
	import { seo } from '$lib/seo';

	let errorMessage = $state('');
	let dots = $state('');

	onMount(async () => {
		// Supabase OAuth implicit flow places tokens in hash fragment (#access_token=...)
		// PKCE / Code exchange flow places tokens in query string (?access_token=...)
		const hashString = window.location.hash.startsWith('#')
			? window.location.hash.slice(1)
			: window.location.hash;

		const hashParams = new URLSearchParams(hashString);
		const searchParams = new URLSearchParams(window.location.search);

		const getParam = (key: string) => hashParams.get(key) || searchParams.get(key);

		console.log('[Auth OAuth Callback] Location received:', {
			hasHash: !!window.location.hash,
			hasSearch: !!window.location.search
		});

		if (getParam('error')) {
			errorMessage =
				getParam('error_description') ||
				getParam('error') ||
				'An error occurred during authentication.';
			console.error('[Auth OAuth Callback] Error from backend:', errorMessage);
			return;
		}

		const accessToken = getParam('access_token');
		const refreshToken = getParam('refresh_token');

		if (!accessToken || !refreshToken) {
			errorMessage = 'Missing authentication tokens. Please try again.';
			console.error('[Auth OAuth Callback] Missing tokens in URL params.');
			return;
		}

		const payload = decodeJwt(accessToken);

		if (!payload || !payload.sub) {
			errorMessage = 'Invalid authentication token. Please try again.';
			console.error('[Auth OAuth Callback] Failed to parse JWT payload.');
			return;
		}

		console.log('[Auth OAuth Callback] Session established for user:', payload.sub);

		sessionStore.set({
			accessToken,
			refreshToken,
			user: {
				id: payload.sub,
				email: payload.email ?? ''
			}
		});

		console.log('[OAuthDebug] Tokens accepted, session stored:', {
			userId: payload.sub,
			email: payload.email ?? '',
			tokensFrom: hashParams.has('access_token') ? 'hash' : 'query'
		});

		await goto(resolve('/app/chat'));
		console.log('[OAuthDebug] Navigated to /app/chat');
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
	{@html seo({
		title: 'Authenticating | Dokyudo',
		description: 'Signing you in to Dokyudo with your external account.'
	})}
</svelte:head>

<div class="flex flex-col items-center justify-center py-12">
	{#if errorMessage}
		<!-- Error State -->
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
		<h1 class="auth-heading text-center text-3xl md:text-4xl">Authentication Failed</h1>
		<p class="auth-subheading mt-2 max-w-sm text-center text-white/80">
			{errorMessage}
		</p>

		<Button href="/login" variant="authPrimary" class="auth-btn-primary mt-2">
			Back to Sign In
		</Button>
	{:else}
		<!-- Loading State -->
		<h1 class="auth-heading mt-6 text-center text-3xl md:text-4xl">
			Authenticating<span class="inline-block w-8 text-left">{dots}</span>
		</h1>
		<p class="auth-subheading mt-2 text-center text-white/80">
			Please wait while we complete your sign in.
		</p>
	{/if}
</div>
