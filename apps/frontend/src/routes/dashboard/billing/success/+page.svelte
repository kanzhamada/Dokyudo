<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { Check, CreditCard, LoaderCircle, ArrowRight, AlertCircle } from 'lucide-svelte';
	import { getMeUsage } from '$lib/api/me';
	import type { UserUsageResponse } from '$lib/types/auth.types';
	import { TIER_PLANS } from '$lib/constants/tiers.constant';

	type PaymentState = 'confirming' | 'success' | 'error';

	let paymentState = $state<PaymentState>('confirming');
	let usage = $state<UserUsageResponse | null>(null);
	let errorMessage = $state('');
	let redirectIn = $state(5);
	let sessionId = $state('');
	let redirectTimer: number | null = null;

	const planName = $derived(usage ? TIER_PLANS[usage.tier].name : TIER_PLANS.SIMULATE.name);
	const hasActivatedTier = $derived(usage?.tier !== undefined && usage.tier !== 'FREE');

	function wait(ms: number) {
		return new Promise((resolve) => window.setTimeout(resolve, ms));
	}

	function startRedirectCountdown() {
		redirectTimer = window.setInterval(() => {
			redirectIn -= 1;
			if (redirectIn <= 0) {
				if (redirectTimer !== null) window.clearInterval(redirectTimer);
				redirectTimer = null;
				void goto('/app?billing=open');
			}
		}, 1000);
	}

	async function confirmPayment() {
		sessionId = $page.url.searchParams.get('session_id') || '';
		if (!sessionId) {
			paymentState = 'error';
			errorMessage = 'The payment session could not be identified.';
			return;
		}

		// Stripe webhooks can arrive just after the browser redirect. Poll briefly so
		// the Billing dialog receives the updated tier instead of stale usage.
		for (let attempt = 0; attempt < 5; attempt += 1) {
			if (attempt > 0) await wait(1500);
			const result = await getMeUsage();
			if (result.ok) {
				usage = result.data;
				if (result.data.tier !== 'FREE' || attempt === 4) break;
			} else if (attempt === 4) {
				paymentState = 'error';
				errorMessage = result.error.message || 'Unable to confirm the payment status.';
				return;
			}
		}

		paymentState = 'success';
		startRedirectCountdown();
	}

	onMount(() => {
		void confirmPayment();
		return () => {
			if (redirectTimer !== null) window.clearInterval(redirectTimer);
		};
	});
</script>

<svelte:head>
	<title>Payment status | Dokyudo</title>
	<meta name="description" content="Your Dokyudo payment status and subscription activation." />
</svelte:head>

<main class="flex min-h-screen items-center justify-center bg-[#1F1E1D] px-4 py-10 text-white">
	<div class="w-full max-w-[480px]">
		<div
			class="mb-8 flex items-center justify-center gap-2 text-sm font-medium tracking-tight text-white/70"
		>
			<CreditCard class="size-4 text-white/50" strokeWidth={1.8} />
			Dokyudo billing
		</div>

		<section
			class="rounded-[18px] border border-white/[0.1] bg-[#242322]/[0.9] p-6 text-center shadow-2xl shadow-black/30 backdrop-blur-[42px] sm:p-8"
		>
			{#if paymentState === 'confirming'}
				<div
					class="mx-auto flex size-14 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.06]"
				>
					<LoaderCircle class="size-6 animate-spin text-white/70" strokeWidth={1.7} />
				</div>
				<h1 class="mt-5 text-2xl font-medium tracking-[-0.03em] text-white">
					Confirming your payment
				</h1>
				<p class="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/45">
					Stripe has returned successfully. We are syncing your Sandbox access before opening your
					billing details.
				</p>
				<div class="mx-auto mt-6 h-1.5 max-w-[240px] overflow-hidden rounded-full bg-white/[0.08]">
					<div class="h-full w-2/3 animate-pulse rounded-full bg-white/50"></div>
				</div>
			{:else if paymentState === 'success'}
				<div
					class="mx-auto flex size-14 items-center justify-center rounded-full border border-white/[0.18] bg-white/[0.1]"
				>
					<Check class="size-7 text-white" strokeWidth={1.8} />
				</div>
				<h1 class="mt-5 text-2xl font-medium tracking-[-0.03em] text-white">Payment successful</h1>
				<p class="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/45">
					{#if hasActivatedTier}
						Your <span class="text-white/75">{planName}</span> access is active. Your Billing panel is
						ready with the latest usage.
					{:else}
						Your payment was received. Subscription activation is still syncing and will appear in
						Billing shortly.
					{/if}
				</p>
				<div class="mt-6 rounded-lg border border-white/[0.1] bg-white/[0.035] px-4 py-3 text-left">
					<div class="flex items-center justify-between gap-3">
						<span class="text-[11px] text-white/40">Plan purchased</span>
						<span class="text-sm font-medium text-white/80"
							>{hasActivatedTier ? planName : 'Sandbox & Evaluation'}</span
						>
					</div>
					<div class="mt-2 flex items-center justify-between gap-3">
						<span class="text-[11px] text-white/40">Next step</span>
						<span class="text-[11px] text-white/60">Billing opens in {redirectIn}s</span>
					</div>
				</div>
			{:else}
				<div
					class="mx-auto flex size-14 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.05]"
				>
					<AlertCircle class="size-7 text-white/70" strokeWidth={1.7} />
				</div>
				<h1 class="mt-5 text-2xl font-medium tracking-[-0.03em] text-white">
					We could not confirm the payment
				</h1>
				<p class="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/45">{errorMessage}</p>
				<button
					type="button"
					class="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-[#1B1B1B] transition-colors hover:bg-white/85"
					onclick={() => goto('/app?billing=open')}
				>
					Open app
					<ArrowRight class="size-4" strokeWidth={1.8} />
				</button>
			{/if}
		</section>

		{#if paymentState === 'success' && sessionId}
			<p class="mt-4 text-center font-mono text-[10px] text-white/25">
				Session {sessionId.slice(0, 14)}...{sessionId.slice(-6)}
			</p>
		{/if}
	</div>
</main>
