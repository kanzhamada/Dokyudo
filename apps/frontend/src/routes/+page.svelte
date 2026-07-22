<script lang="ts">
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';
	import { ScrollTrigger } from 'gsap/ScrollTrigger';

	import LandingNav from '$lib/components/landing/LandingNav.svelte';
	import HeroSection from '$lib/components/landing/HeroSection.svelte';
	import AboutSection from '$lib/components/landing/AboutSection.svelte';
	import FeaturesSection from '$lib/components/landing/FeaturesSection.svelte';
	import TestimonialsSection from '$lib/components/landing/TestimonialsSection.svelte';
	import FaqSection from '$lib/components/landing/FaqSection.svelte';
	import CtaSection from '$lib/components/landing/CtaSection.svelte';
	import Footer from '$lib/components/landing/Footer.svelte';

	gsap.registerPlugin(ScrollTrigger);

	let containerEl: HTMLDivElement;
	let isCollapsed = $state(false);
	let navHovered = $state(false);

	onMount(() => {
		if (!containerEl) return;
		const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		const ctx = gsap.context(() => {
			const navEl = document.getElementById('landing-nav');

			if (!prefersReduced) {
				ScrollTrigger.create({
					scroller: containerEl,
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
		}, containerEl);

		return () => ctx.revert();
	});
</script>

<svelte:head>
	<title>Dokyudo — Semantic Document Search & AI-Powered Q&A</title>
	<meta
		name="description"
		content="Upload documents, search semantically, and ask contextual questions powered by RAG. Enterprise-grade multi-tenant SaaS with hybrid cloud architecture."
	/>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:ital,wght@0,600;1,600&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<LandingNav {isCollapsed} bind:navHovered />

<div class="fullpage-container" bind:this={containerEl}>
	<!-- HERO + LOGO WALL -->
	<div class="snap-section snap-hero">
		<HeroSection {containerEl} />
	</div>

	<!-- ABOUT -->
	<div class="snap-section">
		<AboutSection />
	</div>

	<!-- FEATURES -->
	<div class="snap-section">
		<FeaturesSection />
	</div>

	<!-- TESTIMONIALS -->
	<div class="snap-section">
		<TestimonialsSection />
	</div>

	<!-- FAQ -->
	<div class="snap-section">
		<FaqSection />
	</div>

	<!-- CTA + FOOTER -->
	<div class="snap-section snap-end">
		<CtaSection />
		<Footer />
	</div>
</div>

<style>
	.fullpage-container {
		height: 100vh;
		overflow-y: auto;
		scroll-snap-type: y mandatory;
		scroll-behavior: smooth;

		/* Hide scrollbar across all browsers */
		scrollbar-width: none;
		-ms-overflow-style: none;
	}

	.fullpage-container::-webkit-scrollbar {
		display: none;
	}

	.snap-section {
		scroll-snap-align: start;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.snap-section.snap-hero {
		min-height: max(100vh, 950px);
	}

	.snap-section.snap-end {
		min-height: 100vh;
		justify-content: flex-end;
	}

	:global(html),
	:global(body) {
		overflow: hidden;
		height: 100%;
		margin: 0;
	}
</style>
