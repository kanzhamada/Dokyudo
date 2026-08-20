<script lang="ts">
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';
	import { ScrollTrigger } from 'gsap/ScrollTrigger';
	import { ScrollSmoother } from 'gsap/ScrollSmoother';

	import '$lib/assets/gambetta.css';
	import '$lib/assets/plus-jakarta-sans.css';
	import '$lib/assets/chillax.css';
	import '$lib/assets/landing.css';
	import { initLanding } from '$lib/components/landing/landing-init';

	import { seo } from '$lib/seo';
	import { page } from '$app/state';

	import LandingNav from '$lib/components/landing/LandingNav.svelte';
	import HeroSection from '$lib/components/landing/HeroSection.svelte';
	import LandingIcons from '$lib/components/landing/LandingIcons.svelte';
	import FeaturesSection from '$lib/components/landing/FeaturesSection.svelte';
	import DemoSection from '$lib/components/landing/DemoSection.svelte';
	import ArchitectureSection from '$lib/components/landing/ArchitectureSection.svelte';
	import FallbackSection from '$lib/components/landing/FallbackSection.svelte';
	import TiersSection from '$lib/components/landing/TiersSection.svelte';
	import CompareSection from '$lib/components/landing/CompareSection.svelte';
	import TestimonialsSection from '$lib/components/landing/TestimonialsSection.svelte';
	import FaqSection from '$lib/components/landing/FaqSection.svelte';
	import CtaSection from '$lib/components/landing/CtaSection.svelte';
	import Footer from '$lib/components/landing/Footer.svelte';

	gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

	let isCollapsed = $state(false);
	let navHovered = $state(false);

	onMount(() => {
		const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		// Nav collapse + scroll progress ring (window scroller — the page now
		// scrolls as a normal document, no fullpage snap container).
		const navCtx = gsap.context(() => {
			const navEl = document.getElementById('landing-nav');

			if (!prefersReduced) {
				ScrollTrigger.create({
					start: 'top top',
					end: 'max',
					onUpdate: (self) => {
						isCollapsed = self.scroll() > 80;
						if (navEl) {
							navEl.style.setProperty('--progress', self.progress.toString());
						}
					}
				});
			}
		});

		// Landing page wiring (retrieval demo, architecture, fallback cylinder,
		// tiers unlock, testimonial switcher, FAQ, reveals, ...).
		const disposeLanding = initLanding();

		// Smooth scroll via GSAP ScrollSmoother (skipped for reduced-motion
		// users, who keep native scrolling). In-page anchors are routed through
		// the smoother so nav jumps glide instead of teleporting.
		let smoother: ScrollSmoother | undefined;
		let offAnchorHandler: (() => void) | undefined;

		if (!prefersReduced) {
			const wrapper = document.getElementById('smooth-wrapper');
			const content = document.getElementById('smooth-content');

			if (wrapper && content) {
				smoother = ScrollSmoother.create({
					wrapper,
					content,
					smooth: 1.1,
					smoothTouch: 0.1
				});
				ScrollTrigger.refresh();

				const onClick = (event: MouseEvent) => {
					const link = (event.target as HTMLElement).closest<HTMLAnchorElement>(
						'a[href^="#"]'
					);
					if (!link) return;
					const hash = link.getAttribute('href');
					if (!hash || hash === '#') return;
					const target = document.querySelector(hash);
					if (!target) return;
					event.preventDefault();
					smoother?.scrollTo(target, true, 'top');
				};
				document.addEventListener('click', onClick);
				offAnchorHandler = () => document.removeEventListener('click', onClick);
			}
		}

		return () => {
			offAnchorHandler?.();
			smoother?.kill();
			disposeLanding();
			navCtx.revert();
		};
	});
</script>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html seo({
		title: 'Dokyudo — Semantic Document Search & AI-Powered Q&A',
		description:
			'Upload documents, search semantically, and ask contextual questions powered by RAG. Enterprise-grade multi-tenant SaaS with hybrid cloud architecture.',
		canonical: `${page.url.origin}${page.url.pathname}`,
		ogImage: `${page.url.origin}/landing/hero-dashboard.jpg`
	})}
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"
		rel="stylesheet"
	/>

</svelte:head>

<LandingNav {isCollapsed} bind:navHovered />

<div class="landing-page" id="top">
	<a class="skip-link" href="#main">Skip to content</a>

	<!-- ScrollSmoother wraps everything that scrolls; the nav and the skip
	     link stay outside because position:fixed children of a transformed
	     wrapper lose their viewport anchoring. -->
	<div id="smooth-wrapper">
		<div id="smooth-content">
			<!-- HERO: dark editorial hero with the floating nav pill. Lives outside
			     `.landing-root` so the landing stylesheet never touches it. -->
			<HeroSection />

			<div class="landing-root">
				<!-- Inline icon set (symbols referenced via <use href="#i-...">) -->
				<LandingIcons />

				<main id="main">
					<FeaturesSection />
					<DemoSection />
					<ArchitectureSection />
					<FallbackSection />
					<TiersSection />
					<CompareSection />
					<TestimonialsSection />
					<FaqSection />
					<CtaSection />
				</main>

				<Footer />

				<noscript>
					<div class="noscript">
						This page uses JavaScript for the simulated retrieval demo, the architecture inspector, and the tier unlock. The content above remains fully readable without it.
					</div>
				</noscript>
			</div>
		</div>
	</div>
</div>

<style>
	/* The page scrolls as a normal document now — no fullpage snap container.
	   ScrollSmoother adds its own fixed/transform styles to the wrapper. */
	.landing-page {
		min-height: 100vh;
	}

	/* Skip link — lives outside `.landing-root` and the ScrollSmoother wrapper
	   so its fixed positioning keeps working. The landing-root variable scope
	   doesn't reach here, so the tokens are written out explicitly. */
	.skip-link {
		position: fixed;
		top: -60px;
		left: 15px;
		z-index: 200;
		background: oklch(17.5% 0.01 65); /* --color-black */
		color: oklch(94.5% 0.014 85); /* --color-offwhite */
		padding: 10px 16px;
		border-radius: 6px; /* --r-ctl-s */
		transition:
			transform 200ms cubic-bezier(0.37, 0, 0.63, 1),
			opacity 200ms cubic-bezier(0.37, 0, 0.63, 1);
	}

	.skip-link:focus {
		transform: translateY(72px);
	}
</style>