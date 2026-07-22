<script lang="ts">
	import { ArrowUpRight } from '@lucide/svelte';

	let {
		isCollapsed = false,
		navHovered = $bindable(false)
	}: {
		isCollapsed?: boolean;
		navHovered?: boolean;
	} = $props();
</script>

<nav
	class="landing-nav"
	class:collapsed={isCollapsed && !navHovered}
	id="landing-nav"
	onmouseenter={() => (navHovered = true)}
	onmouseleave={() => (navHovered = false)}
>
	<div class="nav-inner">
		<a href="/" class="nav-logo" aria-label="Dokyudo Home">
			<svg
				width="28"
				height="28"
				viewBox="0 0 32 32"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<rect width="32" height="32" rx="8" fill="var(--color-dk-copper)" />
				<path d="M8 10h6a6 6 0 0 1 0 12H8V10z" fill="var(--color-dk-bg)" />
				<circle cx="22" cy="16" r="4" fill="var(--color-dk-cream)" />
			</svg>
			<span class="nav-logo-text">Dokyudo</span>
		</a>
		<div class="nav-links">
			<a href="#about">About</a>
			<a href="#features">Features</a>
			<a href="#testimonials">Testimonials</a>
			<a href="#faq">FAQ</a>
		</div>
		<div class="nav-actions">
			<a href="/auth/login" class="nav-btn-ghost">Log In</a>
			<a href="/auth/register" class="nav-btn-accent">
				Get Started
				<ArrowUpRight size={14} strokeWidth={2.5} />
			</a>
		</div>
	</div>
</nav>

<style>
	.landing-nav {
		position: fixed;
		top: 16px;
		left: 50%;
		transform: translateX(-50%);
		width: calc(100% - 32px);
		max-width: var(--dk-max-width);
		z-index: 9999;
		padding: 0 16px;
		background: rgba(35, 35, 35, 0.4);
		backdrop-filter: blur(42px);
		-webkit-backdrop-filter: blur(42px);
		border: 1px solid rgba(255, 255, 255, 0.16);
		border-radius: 24px;
		box-shadow:
			0 10px 15px -3px rgba(0, 0, 0, 0.3),
			0 4px 6px -4px rgba(0, 0, 0, 0.2);
		transition:
			width 0.5s cubic-bezier(0.4, 0, 0.2, 1),
			max-width 0.5s cubic-bezier(0.4, 0, 0.2, 1),
			padding 0.5s cubic-bezier(0.4, 0, 0.2, 1),
			border-radius 0.5s cubic-bezier(0.4, 0, 0.2, 1),
			background 0.3s ease;
	}

	/* ── Collapsed (Dynamic Island) state ── */
	.landing-nav.collapsed {
		width: 64px;
		max-width: 64px;
		padding: 0;
		border-radius: 50px;
		background: rgba(35, 35, 35, 0.7);
		overflow: visible;
		border-color: transparent;
	}

	/* Scroll progress as conic-gradient on the navbar border itself */
	.landing-nav.collapsed::before {
		content: '';
		position: absolute;
		inset: -2px;
		border-radius: inherit;
		padding: 2px;
		background: conic-gradient(
			from 0deg,
			rgba(255, 255, 255, 0.85) calc(var(--progress) * 360deg),
			rgba(255, 255, 255, 0.1) calc(var(--progress) * 360deg)
		);
		-webkit-mask:
			linear-gradient(#fff 0 0) content-box,
			linear-gradient(#fff 0 0);
		mask:
			linear-gradient(#fff 0 0) content-box,
			linear-gradient(#fff 0 0);
		-webkit-mask-composite: xor;
		mask-composite: exclude;
		z-index: -1;
		transition: opacity 0.3s ease;
	}

	.landing-nav.collapsed .nav-links,
	.landing-nav.collapsed .nav-actions,
	.landing-nav.collapsed .nav-logo-text {
		opacity: 0;
		pointer-events: none;
		width: 0;
		overflow: hidden;
	}

	.landing-nav.collapsed .nav-inner {
		justify-content: center;
	}

	.landing-nav.collapsed .nav-logo {
		gap: 0;
	}

	.nav-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 56px;
	}

	.nav-logo {
		display: flex;
		align-items: center;
		gap: 10px;
		text-decoration: none;
		color: var(--dk-cream);
		font-weight: 600;
		font-size: 18px;
		letter-spacing: -0.02em;
		transition: gap 0.4s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.nav-logo-text {
		transition:
			opacity 0.3s ease,
			width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
		white-space: nowrap;
	}

	.nav-links {
		display: flex;
		gap: 32px;
		transition:
			opacity 0.3s ease,
			width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
		white-space: nowrap;
	}

	.nav-links a {
		text-decoration: none;
		color: var(--dk-text-muted);
		font-size: 14px;
		font-weight: 400;
		transition: color 0.2s ease;
		letter-spacing: -0.01em;
	}

	.nav-links a:hover {
		color: var(--dk-cream);
	}

	.nav-actions {
		display: flex;
		align-items: center;
		gap: 12px;
		transition:
			opacity 0.3s ease,
			width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
		white-space: nowrap;
	}

	.nav-btn-ghost {
		text-decoration: none;
		color: var(--dk-cream);
		font-size: 14px;
		font-weight: 500;
		padding: 8px 16px;
		border-radius: var(--dk-radius-pill);
		transition: background 0.2s ease;
	}

	.nav-btn-ghost:hover {
		background: rgba(232, 222, 200, 0.08);
	}

	.nav-btn-accent {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		text-decoration: none;
		color: var(--dk-bg);
		font-size: 14px;
		font-weight: 600;
		padding: 8px 18px;
		border-radius: var(--dk-radius-pill);
		background: var(--dk-copper);
		transition:
			background 0.2s ease,
			transform 0.15s ease;
	}

	.nav-btn-accent:hover {
		background: var(--color-dk-copper-hover);
		transform: translateY(-1px);
	}
</style>
