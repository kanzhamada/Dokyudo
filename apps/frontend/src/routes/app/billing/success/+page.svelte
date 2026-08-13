<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { Check, CreditCard, LoaderCircle, ArrowRight, AlertCircle } from 'lucide-svelte';
	import { getMeUsage } from '$lib/api/me';
	import { seo } from '$lib/seo';
	import type { UserUsageResponse } from '$lib/types/auth.types';
	import { verifyCheckoutSession } from '$lib/api/payments';
	import { TIER_PLANS, type TierType } from '$lib/constants/tiers.constant';

	type PaymentState = 'confirming' | 'success' | 'syncing' | 'error';

	let paymentState = $state<PaymentState>('confirming');
	let usage = $state<UserUsageResponse | null>(null);
	let verifiedTier = $state<TierType | null>(null);
	let errorMessage = $state('');
	let redirectIn = $state(5);
	let sessionId = $state('');
	let redirectTimer: number | null = null;
	let confettiCleanupTimer: number | null = null;

	const planName = $derived(
		usage
			? TIER_PLANS[usage.tier].name
			: verifiedTier
				? TIER_PLANS[verifiedTier].name
				: TIER_PLANS.SIMULATE.name
	);
	const hasActivatedTier = $derived(
		(usage?.tier !== undefined && usage.tier !== 'FREE') ||
			(verifiedTier !== null && verifiedTier !== 'FREE')
	);

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

		// The session_id in the URL is attacker-controlled. Verify it server-side:
		// Stripe retrieves the session and checks it belongs to the authenticated
		// tenant. Only a verified, paid session reaches the success state.
		const result = await verifyCheckoutSession(sessionId);
		if (!result.ok) {
			paymentState = 'error';
			errorMessage = result.error?.message || 'Unable to confirm the payment status.';
			return;
		}

		verifiedTier = (result.data.tier as TierType | null) ?? null;

		// Paid or no payment required: session confirmed. Best-effort usage fetch
		// only to show the freshest plan name; it never gates the success state.
		if (result.data.status === 'paid' || result.data.status === 'no_payment_required') {
			const usageResult = await getMeUsage();
			if (usageResult.ok) usage = usageResult.data;

			paymentState = 'success';
			launchConfetti();
			startRedirectCountdown();
			return;
		}

		// Valid session but payment still processing (e.g. async method).
		paymentState = 'syncing';
		startRedirectCountdown();
	}

	function launchConfetti() {
		if (
			typeof window === 'undefined' ||
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		) {
			return;
		}

		const canvas = document.createElement('canvas');
		canvas.className = 'billing-confetti';
		canvas.setAttribute('aria-hidden', 'true');
		document.body.appendChild(canvas);
		const context = canvas.getContext('2d');
		if (!context) {
			canvas.remove();
			return;
		}

		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const resize = () => {
			canvas.width = window.innerWidth * dpr;
			canvas.height = window.innerHeight * dpr;
			canvas.style.width = `${window.innerWidth}px`;
			canvas.style.height = `${window.innerHeight}px`;
			context.setTransform(dpr, 0, 0, dpr, 0, 0);
		};
		resize();
		window.addEventListener('resize', resize);

		const colors = ['#DB8F5E', '#F0D9C7', '#FFFFFF', '#8C6250'];
		const pieces = Array.from({ length: 72 }, (_, index) => ({
			x: window.innerWidth / 2 + (Math.random() - 0.5) * 180,
			y: window.innerHeight * 0.32,
			vx: (Math.random() - 0.5) * 8,
			vy: -Math.random() * 8 - 3,
			rotation: Math.random() * Math.PI,
			spin: (Math.random() - 0.5) * 0.25,
			width: 4 + (index % 3) * 2,
			height: 7 + (index % 4) * 2,
			color: colors[index % colors.length]
		}));

		const startedAt = performance.now();
		const draw = (now: number) => {
			const elapsed = now - startedAt;
			context.clearRect(0, 0, window.innerWidth, window.innerHeight);
			for (const piece of pieces) {
				piece.x += piece.vx;
				piece.vy += 0.18;
				piece.y += piece.vy;
				piece.rotation += piece.spin;
				context.save();
				context.translate(piece.x, piece.y);
				context.rotate(piece.rotation);
				context.fillStyle = piece.color;
				context.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
				context.restore();
			}
			if (elapsed < 2600) {
				requestAnimationFrame(draw);
			}
		};
		requestAnimationFrame(draw);

		confettiCleanupTimer = window.setTimeout(() => {
			window.removeEventListener('resize', resize);
			canvas.remove();
			confettiCleanupTimer = null;
		}, 2800);
	}

	onMount(() => {
		void confirmPayment();
		return () => {
			if (redirectTimer !== null) window.clearInterval(redirectTimer);
			if (confettiCleanupTimer !== null) window.clearTimeout(confettiCleanupTimer);
			document.querySelector('.billing-confetti')?.remove();
		};
	});
</script>

<svelte:head>
	{@html seo({ title: 'Payment status | Dokyudo', description: 'Your Dokyudo payment status and subscription activation.', noindex: true })}
</svelte:head>

<main class="billing-page">
	<div class="billing-shell">
		<header class="billing-brand">
			<CreditCard class="size-4" strokeWidth={1.8} />
			<span>Dokyudo billing</span>
		</header>

		<section class="billing-summary" aria-live="polite">
			{#if paymentState === 'confirming'}
				<div class="billing-status-icon billing-status-icon--pending">
					<LoaderCircle class="size-6 animate-spin" strokeWidth={1.7} />
				</div>
				<p class="billing-kicker">Payment status</p>
				<h1 class="billing-heading">Confirming your payment</h1>
				<p class="billing-copy">
					Stripe has returned successfully. We are syncing your Sandbox access before opening your
					billing details.
				</p>
				<div class="billing-progress" aria-label="Payment confirmation in progress">
					<span></span>
				</div>
			{:else if paymentState === 'success'}
				<div class="billing-status-icon billing-status-icon--success">
					<Check class="size-7" strokeWidth={1.8} />
				</div>
				<p class="billing-kicker">Payment status</p>
				<h1 class="billing-heading">Payment successful</h1>
				<p class="billing-copy">
					{#if hasActivatedTier}
						Your <strong>{planName}</strong> access is active. Your Billing panel is ready with the latest
						usage.
					{:else}
						Your payment was received. Subscription activation is still syncing and will appear in
						Billing shortly.
					{/if}
				</p>
				<div class="billing-plan-summary">
					<div>
						<span>Plan purchased</span>
						<strong>{hasActivatedTier ? planName : 'Sandbox & Evaluation'}</strong>
					</div>
					<div>
						<span>Next step</span>
						<strong>Billing opens in {redirectIn}s</strong>
					</div>
				</div>

				{#if sessionId}
					<div class="billing-metadata">
						<div class="billing-metadata-item">
							<span>Session</span>
							<strong>{sessionId.slice(0, 14)}...{sessionId.slice(-6)}</strong>
						</div>
						<div class="billing-metadata-item">
							<span>Access</span>
							<strong>{hasActivatedTier ? 'Active' : 'Syncing'}</strong>
						</div>
					</div>
				{/if}

				<div class="billing-actions">
					<button
						type="button"
						class="billing-primary-action"
						onclick={() => goto('/app?billing=open')}
					>
						Open billing
						<ArrowRight class="size-4" strokeWidth={1.8} />
					</button>
				</div>
			{:else if paymentState === 'syncing'}
				<div class="billing-status-icon billing-status-icon--pending">
					<LoaderCircle class="size-6 animate-spin" strokeWidth={1.7} />
				</div>
				<p class="billing-kicker">Payment status</p>
				<h1 class="billing-heading">Payment received</h1>
				<p class="billing-copy">
					Your payment was received. Subscription activation is still syncing and will appear in
					Billing shortly.
				</p>
				<div class="billing-plan-summary">
					<div>
						<span>Plan purchased</span>
						<strong>{hasActivatedTier ? planName : 'Sandbox & Evaluation'}</strong>
					</div>
					<div>
						<span>Next step</span>
						<strong>Billing opens in {redirectIn}s</strong>
					</div>
				</div>
			{:else}
				<div class="billing-status-icon billing-status-icon--error">
					<AlertCircle class="size-7" strokeWidth={1.7} />
				</div>
				<p class="billing-kicker">Payment status</p>
				<h1 class="billing-heading">We could not confirm the payment</h1>
				<p class="billing-copy">{errorMessage}</p>
				<div class="billing-actions">
					<button
						type="button"
						class="billing-primary-action"
						onclick={() => goto('/app?billing=open')}
					>
						Open app
						<ArrowRight class="size-4" strokeWidth={1.8} />
					</button>
				</div>
			{/if}
		</section>
	</div>
</main>

<style>
	.billing-page {
		height: 100%;
		width: 100%;
		overflow-y: auto;
		color: #f4f1ed;
		padding: 2.5rem 1.5rem 4rem;
	}
	.billing-shell {
		width: min(100%, 760px);
		margin: 0 auto;
	}
	.billing-brand {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		margin-bottom: 3.5rem;
		color: #c9c2bb;
		font-size: 0.875rem;
		font-weight: 600;
	}
	.billing-brand :global(svg) {
		color: #db8f5e;
	}
	.billing-summary {
		border-top: 1px solid #514a45;
		border-bottom: 1px solid #514a45;
		padding: 2.25rem 0 2rem;
		text-align: left;
		animation: billing-enter 500ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}
	.billing-status-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3.5rem;
		height: 3.5rem;
		margin-bottom: 1.5rem;
		border: 1px solid #756052;
		border-radius: 0.75rem;
	}
	.billing-status-icon--success {
		background: #db8f5e;
		border-color: #db8f5e;
		color: #1f1e1d;
	}
	.billing-status-icon--pending {
		color: #db8f5e;
	}
	.billing-status-icon--error {
		color: #e0a48a;
		border-color: #8f5d4d;
	}
	.billing-kicker {
		margin: 0 0 0.5rem;
		color: #a59b93;
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.billing-heading {
		max-width: 12ch;
		margin: 0;
		color: #f4f1ed;
		font-size: clamp(2.5rem, 7vw, 4.75rem);
		font-weight: 600;
		letter-spacing: -0.065em;
		line-height: 0.98;
	}
	.billing-copy {
		max-width: 42rem;
		margin: 1.25rem 0 0;
		color: #b8afa8;
		font-size: 0.9375rem;
		line-height: 1.7;
	}
	.billing-copy strong {
		color: #f4f1ed;
		font-weight: 600;
	}
	.billing-progress {
		height: 0.25rem;
		max-width: 18rem;
		margin-top: 2rem;
		overflow: hidden;
		background: #3a3532;
	}
	.billing-progress span {
		display: block;
		width: 62%;
		height: 100%;
		background: #db8f5e;
		animation: billing-progress 1.4s ease-in-out infinite alternate;
	}
	.billing-plan-summary {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.5rem;
		margin-top: 2.5rem;
		padding: 1.5rem 0;
		border-top: 1px solid #514a45;
		border-bottom: 1px solid #514a45;
	}
	.billing-plan-summary > div,
	.billing-metadata-item {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}
	.billing-plan-summary span,
	.billing-metadata-item span {
		color: #918880;
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.billing-plan-summary strong,
	.billing-metadata-item strong {
		color: #f4f1ed;
		font-size: 0.9375rem;
		font-weight: 600;
		line-height: 1.4;
	}
	.billing-metadata {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.5rem;
		padding: 1.5rem 0;
	}
	.billing-actions {
		display: flex;
		margin-top: 1.5rem;
	}
	.billing-primary-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		min-height: 2.75rem;
		padding: 0.75rem 1.25rem;
		border: 1px solid #db8f5e;
		border-radius: 0.625rem;
		background: #db8f5e;
		color: #1f1e1d;
		font-size: 0.8125rem;
		font-weight: 700;
		cursor: pointer;
		transition:
			background-color 180ms ease,
			transform 180ms ease;
	}
	.billing-primary-action:hover {
		background: #e5a06f;
	}
	.billing-primary-action:active {
		transform: translateY(1px);
	}
	.billing-primary-action:focus-visible {
		outline: 2px solid #f0d9c7;
		outline-offset: 3px;
	}
	@keyframes billing-enter {
		from {
			opacity: 0;
			transform: translateY(0.75rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@keyframes billing-progress {
		from {
			transform: translateX(-35%);
		}
		to {
			transform: translateX(55%);
		}
	}
	:global(.billing-confetti) {
		position: fixed;
		inset: 0;
		z-index: 20;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	@media (max-width: 640px) {
		.billing-page {
			padding: 1.5rem 1rem 3rem;
		}
		.billing-brand {
			margin-bottom: 2.5rem;
		}
		.billing-summary {
			padding-top: 1.75rem;
		}
		.billing-plan-summary,
		.billing-metadata {
			grid-template-columns: 1fr;
			gap: 1.25rem;
		}
		.billing-primary-action {
			width: 100%;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.billing-summary,
		.billing-progress span {
			animation: none;
		}
	}
</style>
