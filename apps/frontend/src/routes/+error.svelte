<script lang="ts">
	import { ArrowUpRight } from '@lucide/svelte';
	import '@fontsource/geist-mono/500.css';
	import favicon from '$lib/assets/favicon.svg?raw';
	import { page } from '$app/state';

	const is404 = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{is404 ? '404 - Page not found - Dokyudo' : 'Error - Dokyudo'}</title>
	<meta
		name="description"
		content="The page you aimed for is not here. Head back to Dokyudo and search your documents."
	/>
	<link rel="preload" as="image" href="/images/404.webp" />
</svelte:head>

<main class="dk-err">
	<img class="dk-err-bg" src="/images/404.webp" alt="" aria-hidden="true" />
	<div class="dk-err-scrim" aria-hidden="true"></div>

	<a class="dk-err-logo" href="/" aria-label="Dokyudo Home">
		<div class="dk-err-logo-mark [&_path]:fill-white [&>svg]:size-6">{@html favicon}</div>
		<span class="dk-err-logo-text">okyudo</span>
	</a>

	<div class="dk-err-content">
		<div class="dk-err-seal" aria-hidden="true">404</div>

		{#if is404}
			<h1 class="dk-err-title">Off <em>target</em>.</h1>
			<p class="dk-err-body">The page you aimed for is not here. Check the link, or start a new chat.</p>
			<div class="dk-err-ctas">
				<a class="dk-btn-primary" href="/">Back to Home</a>
				<a class="dk-btn-outline" href="/app/chat">
					Start a Chat
					<ArrowUpRight size={15} strokeWidth={2.5} />
				</a>
			</div>
		{:else}
			<h1 class="dk-err-title">Something went <em>wrong</em>.</h1>
			<p class="dk-err-body">An unexpected error interrupted your request. Give it a moment, then try again.</p>
			<div class="dk-err-ctas">
				<a class="dk-btn-primary" href="/">Back to Home</a>
			</div>
		{/if}
	</div>
</main>

<style>
	.dk-err {
		position: relative;
		min-height: 100vh;
		min-height: 100dvh;
		overflow-x: hidden;
		overflow-y: auto;
		background: var(--color-dk-bg);
		color: var(--color-dk-cream);
	}

	/* ── Background: full-viewport cover with a slow drift ── */
	.dk-err-bg {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 68% 28%;
		transform: scale(1.02);
		animation: dk-err-drift 30s ease-in-out infinite alternate;
		will-change: transform;
	}

	@keyframes dk-err-drift {
		from {
			transform: scale(1.02);
		}
		to {
			transform: scale(1.09);
		}
	}

	/* ── Readability scrims: top (logo), left (text), bottom (mobile) ── */
	.dk-err-scrim {
		position: fixed;
		inset: 0;
		pointer-events: none;
		background:
			linear-gradient(to bottom, rgba(28, 27, 27, 0.55) 0%, rgba(28, 27, 27, 0) 140px),
			linear-gradient(
				100deg,
				rgba(28, 27, 27, 0.92) 0%,
				rgba(28, 27, 27, 0.6) 36%,
				rgba(28, 27, 27, 0.18) 62%,
				rgba(28, 27, 27, 0) 82%
			),
			linear-gradient(to top, rgba(28, 27, 27, 0.82) 0%, rgba(28, 27, 27, 0.3) 34%, rgba(28, 27, 27, 0) 62%);
	}

	/* ── Logo capsule, mirroring the landing nav glass recipe ── */
	.dk-err-logo {
		position: fixed;
		top: 16px;
		left: 16px;
		z-index: 10;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 9px 18px;
		border-radius: 24px;
		background: rgba(35, 35, 35, 0.4);
		backdrop-filter: blur(42px);
		-webkit-backdrop-filter: blur(42px);
		border: 1px solid rgba(255, 255, 255, 0.16);
		box-shadow:
			0 10px 15px -3px rgba(0, 0, 0, 0.3),
			0 4px 6px -4px rgba(0, 0, 0, 0.2);
		text-decoration: none;
		transition:
			border-color 200ms cubic-bezier(0.37, 0, 0.63, 1),
			background 200ms cubic-bezier(0.37, 0, 0.63, 1);
	}

	.dk-err-logo:hover {
		border-color: rgba(255, 255, 255, 0.3);
		background: rgba(35, 35, 35, 0.55);
	}

	.dk-err-logo-mark {
		display: flex;
	}

	.dk-err-logo-text {
		color: var(--color-dk-cream);
		font-family: var(--font-subhead);
		font-size: 18px;
		font-weight: 600;
		letter-spacing: -0.02em;
		white-space: nowrap;
	}

	/* ── Content block, left-aligned over the clear zone ── */
	.dk-err-content {
		position: relative;
		z-index: 1;
		min-height: 100vh;
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: flex-start;
		max-width: 680px;
		padding: 140px clamp(24px, 6vw, 72px) 56px;
	}

	/* ── 404 hanko seal ── */
	.dk-err-seal {
		display: grid;
		place-items: center;
		width: 72px;
		height: 72px;
		margin-bottom: 30px;
		border: 1px solid var(--dk-copper);
		border-radius: var(--dk-radius-sm);
		background: var(--dk-accent-glow);
		box-shadow: 0 14px 34px rgba(0, 0, 0, 0.28);
		color: var(--dk-copper);
		font-family: 'Geist Mono', monospace;
		font-weight: 500;
		font-size: 22px;
		letter-spacing: -0.02em;
		rotate: -8deg;
		animation: dk-err-up 700ms cubic-bezier(0.16, 1, 0.3, 1) both;
	}

	.dk-err-title {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(2.75rem, 7vw, 5rem);
		line-height: 1.2;
		letter-spacing: -0.02em;
		color: var(--color-dk-cream);
		animation: dk-err-up 700ms cubic-bezier(0.16, 1, 0.3, 1) 120ms both;
	}

	.dk-err-title em {
		font-style: italic;
		font-weight: 500;
		color: var(--dk-copper);
	}

	.dk-err-body {
		margin: 18px 0 0;
		font-family: var(--font-body);
		font-size: 16px;
		line-height: 1.6;
		color: var(--color-dk-text-muted);
		max-width: 46ch;
		animation: dk-err-up 700ms cubic-bezier(0.16, 1, 0.3, 1) 240ms both;
	}

	.dk-err-ctas {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 38px;
		animation: dk-err-up 700ms cubic-bezier(0.16, 1, 0.3, 1) 360ms both;
	}

	.dk-btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 10px 22px;
		border: 1px solid transparent;
		border-radius: var(--dk-radius-sm);
		background: var(--dk-copper);
		color: var(--dk-bg);
		font-family: var(--font-subhead);
		font-size: 14px;
		font-weight: 600;
		letter-spacing: -0.02em;
		text-decoration: none;
		transition:
			background 200ms cubic-bezier(0.37, 0, 0.63, 1),
			transform 200ms cubic-bezier(0.37, 0, 0.63, 1);
	}

	.dk-btn-primary:hover {
		background: var(--color-dk-copper-hover);
	}

	.dk-btn-primary:active {
		transform: scale(0.98);
	}

	.dk-btn-outline {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 10px 22px;
		border: 1px solid var(--dk-border-strong);
		border-radius: var(--dk-radius-sm);
		background: transparent;
		color: var(--color-dk-cream);
		font-family: var(--font-subhead);
		font-size: 14px;
		font-weight: 500;
		letter-spacing: -0.02em;
		text-decoration: none;
		transition:
			border-color 200ms cubic-bezier(0.37, 0, 0.63, 1),
			background 200ms cubic-bezier(0.37, 0, 0.63, 1),
			transform 200ms cubic-bezier(0.37, 0, 0.63, 1);
	}

	.dk-btn-outline:hover {
		border-color: var(--dk-copper);
		background: var(--dk-accent-glow);
	}

	.dk-btn-outline:active {
		transform: scale(0.98);
	}

	.dk-err a:focus-visible {
		outline: 2px solid var(--dk-copper);
		outline-offset: 2px;
	}

	@keyframes dk-err-up {
		from {
			opacity: 0;
			transform: translateY(22px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* ── Mobile: tighter seal, smaller side gutters ── */
	@media (max-width: 767px) {
		.dk-err-seal {
			width: 64px;
			height: 64px;
			font-size: 19px;
		}

		.dk-err-content {
			padding-top: 120px;
		}
	}
</style>
