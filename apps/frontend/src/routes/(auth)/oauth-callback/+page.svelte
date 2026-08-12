<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { sessionStore } from '$lib/state/session.store.svelte';
	import Button from '$lib/components/ui/button/button.svelte';

	let errorMessage = $state('');
	let dots = $state('');

	function parseJwt(token: string) {
		try {
			const parts = token.split('.');
			if (parts.length < 2) return null;
			let base64Url = parts[1];
			let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
			while (base64.length % 4 !== 0) {
				base64 += '=';
			}
			const jsonPayload = decodeURIComponent(
				atob(base64)
					.split('')
					.map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
					.join('')
			);
			return JSON.parse(jsonPayload);
		} catch (e) {
			console.error('[Auth OAuth Callback] JWT Parse Exception:', e);
			return null;
		}
	}

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

		const payload = parseJwt(accessToken);

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

		await goto('/app/chat');
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


		<Button
		    href="/login"
			variant="authPrimary"
			class="auth-btn-primary mt-2"
		>
		    Back to Sign In
		</Button>
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
