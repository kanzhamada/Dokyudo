<script lang="ts">
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';
	import { ScrollTrigger } from 'gsap/ScrollTrigger';
	import { ArrowUpRight } from '@lucide/svelte';

	import book from '$lib/assets/landing_pages/book.webp';
	import paper1 from '$lib/assets/landing_pages/paper1.webp';
	import paper2 from '$lib/assets/landing_pages/paper2.webp';
	import paper3 from '$lib/assets/landing_pages/paper3.webp';
	import paper4 from '$lib/assets/landing_pages/paper4.webp';
	import paper5 from '$lib/assets/landing_pages/paper5.webp';
	import paper6 from '$lib/assets/landing_pages/paper6.webp';
	import paper7 from '$lib/assets/landing_pages/paper7.webp';
	import flower1 from '$lib/assets/landing_pages/flower 1.webp';
	import flower2 from '$lib/assets/landing_pages/flower2.webp';
	import flower3 from '$lib/assets/landing_pages/flower3.webp';
	import flower4 from '$lib/assets/landing_pages/flower4.webp';
	import flower5 from '$lib/assets/landing_pages/flower5.webp';
	import flower6 from '$lib/assets/landing_pages/flower6.webp';
	import flower7 from '$lib/assets/landing_pages/flower7.webp';
	import flower8 from '$lib/assets/landing_pages/flower8.webp';
	import dokyudoTop from '$lib/assets/landing_pages/Dokyudo Top.svg';
	import dokyudoMiddle from '$lib/assets/landing_pages/Dokyudo Middle.svg';
	import dokyudoBottom from '$lib/assets/landing_pages/Dokyudo Bottom.svg';
	import LogoWall from '$lib/components/app/LogoWall.svelte';

	gsap.registerPlugin(ScrollTrigger);

	let { containerEl }: { containerEl?: HTMLDivElement | null } = $props();

	let heroSectionEl = $state<HTMLElement | null>(null);

	onMount(() => {
		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const scroller = containerEl || heroSectionEl?.closest('.fullpage-container') || window;
		const scope = heroSectionEl || undefined;

		const ctx = gsap.context(() => {
			/* A. Hero Entry Timeline */
			const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });

			heroTl
				.fromTo(
					'.hero-bg-elements',
					{ autoAlpha: 0, scale: 0.98 },
					{ autoAlpha: 1, scale: 1, duration: 1.2 }
				)
				.fromTo(
					'.hero-text-container',
					{ autoAlpha: 0, y: 40, xPercent: -50 },
					{ autoAlpha: 1, y: 0, xPercent: -50, duration: 1 },
					'-=0.9'
				);

			if (!prefersReducedMotion) {
				/* B. Scroll Parallax */
				gsap.to('.hero-scroll-parallax', {
					y: 150,
					ease: 'none',
					scrollTrigger: {
						trigger: '.snap-hero',
						scroller: scroller,
						start: 'top top',
						end: 'bottom top',
						scrub: true
					}
				});

				gsap.to('.hero-text-parallax', {
					y: 250,
					opacity: 0,
					ease: 'none',
					scrollTrigger: {
						trigger: '.snap-hero',
						scroller: scroller,
						start: 'top top',
						end: '70% top',
						scrub: true
					}
				});

				/* C. Float Animations */
				const floatElements = [
					{ sel: '.bg-el.book', y: -14, rot: 1.5, dur: 7, delay: 2 },
					{ sel: '.bg-el.paper1', y: -10, rot: 0, dur: 6, delay: 1 },
					{ sel: '.bg-el.paper2', y: -12, rot: -1.5, dur: 8, delay: 4 },
					{ sel: '.bg-el.paper3', y: -14, rot: 1.5, dur: 6.5, delay: 3 },
					{ sel: '.bg-el.paper4', y: -10, rot: 0, dur: 7.5, delay: 0 },
					{ sel: '.bg-el.paper5', y: -12, rot: -1.5, dur: 9, delay: 5 },
					{ sel: '.bg-el.paper6', y: -14, rot: 1.5, dur: 5.5, delay: 2 },
					{ sel: '.bg-el.paper7', y: -10, rot: 0, dur: 8.5, delay: 1.5 },
					{ sel: '.bg-el.flower1', y: -14, rot: 1.5, dur: 6.8, delay: 4 },
					{ sel: '.bg-el.flower2', y: -10, rot: 0, dur: 7.2, delay: 0.5 },
					{ sel: '.bg-el.flower3', y: -12, rot: -1.5, dur: 8.2, delay: 2.5 },
					{ sel: '.bg-el.flower4', y: -14, rot: 1.5, dur: 5.8, delay: 1 },
					{ sel: '.bg-el.flower5', y: -10, rot: 0, dur: 9.5, delay: 6 },
					{ sel: '.bg-el.flower6', y: -12, rot: -1.5, dur: 7.7, delay: 3 },
					{ sel: '.bg-el.flower7', y: -14, rot: 1.5, dur: 6.2, delay: 0 },
					{ sel: '.bg-el.flower8', y: -10, rot: 0, dur: 8.8, delay: 4.5 }
				];

				floatElements.forEach((item) => {
					const tween = gsap.to(item.sel, {
						y: item.y,
						rotation: item.rot,
						duration: item.dur,
						repeat: -1,
						yoyo: true,
						ease: 'sine.inOut'
					});
					if (item.delay > 0) {
						tween.progress(item.delay / item.dur);
					}
				});
			}

			/* D. Hover Micro-Spread */
			if (heroSectionEl) {
				const bgEls = heroSectionEl.querySelectorAll<HTMLElement>('.bg-el');
				bgEls.forEach((el) => {
					const computed = getComputedStyle(el);
					const txVal = computed.getPropertyValue('--hover-tx').trim();
					const tyVal = computed.getPropertyValue('--hover-ty').trim();

					if (!txVal && !tyVal) return;

					const tx = parseFloat(txVal) || 0;
					const ty = parseFloat(tyVal) || 0;

					el.addEventListener('mouseenter', () => {
						gsap.to(el, {
							translate: `${tx}px ${ty}px`,
							duration: 0.5,
							ease: 'back.out(2)',
							overwrite: 'auto'
						});
					});

					el.addEventListener('mouseleave', () => {
						gsap.to(el, {
							translate: '0px 0px',
							duration: 0.5,
							ease: 'power2.out',
							overwrite: 'auto'
						});
					});
				});
			}
		}, scope);

		return () => {
			ctx.revert();
		};
	});
</script>

<div class="snap-section snap-hero" bind:this={heroSectionEl}>
	<section class="hero-section" id="hero">
		<div class="hero-content-wrapper">
			<!-- Parallax wrapper for background -->
			<div class="hero-scroll-parallax">
				<div class="hero-bg-elements">
					<img src={book} class="bg-el book" alt="" aria-hidden="true" />
					<img src={paper1} class="bg-el paper1" alt="" aria-hidden="true" />
					<img src={paper2} class="bg-el paper2" alt="" aria-hidden="true" />
					<img src={paper3} class="bg-el paper3" alt="" aria-hidden="true" />
					<img src={paper4} class="bg-el paper4" alt="" aria-hidden="true" />
					<img src={paper5} class="bg-el paper5" alt="" aria-hidden="true" />
					<img src={paper6} class="bg-el paper6" alt="" aria-hidden="true" />
					<img src={paper7} class="bg-el paper7" alt="" aria-hidden="true" />
					<img src={flower1} class="bg-el flower1" alt="" aria-hidden="true" />
					<img src={flower2} class="bg-el flower2" alt="" aria-hidden="true" />
					<img src={flower3} class="bg-el flower3" alt="" aria-hidden="true" />
					<img src={flower4} class="bg-el flower4" alt="" aria-hidden="true" />
					<img src={flower5} class="bg-el flower5" alt="" aria-hidden="true" />
					<img src={flower6} class="bg-el flower6" alt="" aria-hidden="true" />
					<img src={flower7} class="bg-el flower7" alt="" aria-hidden="true" />
					<img src={flower8} class="bg-el flower8" alt="" aria-hidden="true" />

					<img src={dokyudoBottom} class="bg-el dokyudo-bottom" alt="" aria-hidden="true" />
					<img src={dokyudoMiddle} class="bg-el dokyudo-middle" alt="" aria-hidden="true" />
					<img src={dokyudoTop} class="bg-el dokyudo-top" alt="" aria-hidden="true" />
				</div>
			</div>

			<!-- Parallax wrapper for text -->
			<div class="hero-text-parallax z-50">
				<div class="hero-text-container">
					<h1 class="hero-headline">
						Search Your Documents<br />
						with <span class="highlight-meaning">Meaning</span>
					</h1>
					<div class="hero-ctas">
						<a href="/register" class="btn-primary">
							Start Free
							<ArrowUpRight size={15} strokeWidth={2.5} />
						</a>
						<a href="#features" class="btn-outline">
							See Features
							<ArrowUpRight size={15} strokeWidth={2} />
						</a>
					</div>
					<div style="margin-top: 48px; width: 100%;">
						<LogoWall />
					</div>
				</div>
			</div>
		</div>
	</section>
</div>

<style>
	.snap-section {
		scroll-snap-align: start;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.snap-section.snap-hero {
		min-height: max(100vh, 950px);
	}

	.snap-section.snap-hero .hero-section {
		flex: 1;
	}

	/* ── Buttons (Shared) ── */
	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		text-decoration: none;
		color: var(--dk-bg);
		font-size: 14px;
		font-weight: 600;
		padding: 10px 22px;
		border-radius: var(--dk-radius-sm);
		background: var(--dk-copper);
		border: none;
		cursor: pointer;
		transition:
			background 200ms cubic-bezier(0.37, 0, 0.63, 1),
			transform 200ms cubic-bezier(0.37, 0, 0.63, 1);
		letter-spacing: -0.02em;
	}

	.btn-primary:hover {
		background: var(--color-dk-copper-hover);
	}

	.btn-primary:active {
		transform: scale(0.98);
	}

	.btn-outline {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		text-decoration: none;
		color: var(--dk-cream);
		font-size: 14px;
		font-weight: 500;
		padding: 10px 22px;
		border-radius: var(--dk-radius-sm);
		background: transparent;
		border: 1px solid var(--dk-border-strong);
		cursor: pointer;
		transition:
			border-color 200ms cubic-bezier(0.37, 0, 0.63, 1),
			background 200ms cubic-bezier(0.37, 0, 0.63, 1),
			transform 200ms cubic-bezier(0.37, 0, 0.63, 1);
		letter-spacing: -0.02em;
	}

	.btn-outline:hover {
		border-color: var(--dk-copper);
		background: var(--dk-accent-glow);
	}

	.btn-outline:active {
		transform: scale(0.98);
	}

	/* ── Hero Section ── */
	@property --spread-multiplier {
		syntax: '<number>';
		inherits: true;
		initial-value: 1;
	}

	.hero-section {
		background: var(--dk-bg);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		overflow: hidden;
		position: relative;
		min-height: max(100vh, 950px);
	}

	.hero-content-wrapper {
		position: relative;
		width: 100%;
		height: 760px;
		max-width: var(--dk-max-width);
	}

	.hero-section::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-image:
			linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.5)), url('$lib/assets/images/hero_section.webp');
		background-size: cover;
		background-position: center;
		z-index: 0;
		pointer-events: none;
		filter: blur(6px);
		transform: scale(1.8);
	}

	.hero-section::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100%;
		height: 666px;
		background: linear-gradient(to bottom, rgba(28, 27, 27, 0) 0%, var(--color-dk-bg) 69%);
		z-index: 50;
		pointer-events: none;
	}

	.hero-bg-elements {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 0;
	}

	.hero-scroll-parallax {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.hero-text-parallax {
		position: relative;
		z-index: 100;
		width: 100%;
		pointer-events: none;
	}

	.bg-el {
		position: absolute;
		left: calc(50% + calc(var(--x-offset) * var(--spread-multiplier) * 1px));
		top: calc(475px + calc(calc(var(--y) - 475) * var(--spread-multiplier) * 1px));
		z-index: 10;
		pointer-events: auto;
		/*cursor: pointer;*/
		translate: 0 0;
		transition:
			left 0.8s cubic-bezier(0.16, 1, 0.3, 1),
			top 0.8s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.bg-el:hover {
		z-index: 70;
	}

	/* Explicit Z-Index Layering */
	.bg-el.dokyudo-bottom {
		z-index: 20;
		pointer-events: none;
	}
	.bg-el.book,
	.bg-el.flower2,
	.bg-el.paper2 {
		z-index: 30;
	}
	.bg-el.dokyudo-middle {
		z-index: 40;
		pointer-events: none;
	}
	.bg-el.paper1,
	.bg-el.flower1 {
		z-index: 50;
	}
	.bg-el.dokyudo-top {
		z-index: 60;
		pointer-events: none;
	}

	.bg-el.book {
		--x-offset: -789.21;
		--y: 150.41;
		--hover-tx: -14px;
		--hover-ty: -10px;
	}
	.bg-el.paper1 {
		--x-offset: -255.79;
		--y: 262.56;
		--hover-tx: -12px;
		--hover-ty: -6px;
	}
	.bg-el.paper2 {
		--x-offset: -43.96;
		--y: 382.25;
		--hover-tx: -8px;
		--hover-ty: 12px;
	}
	.bg-el.paper3 {
		--x-offset: 247.54;
		--y: 132.14;
		--hover-tx: 10px;
		--hover-ty: -14px;
	}
	.bg-el.paper4 {
		--x-offset: 269.33;
		--y: 307.27;
		--hover-tx: 16px;
		--hover-ty: 8px;
	}
	.bg-el.paper5 {
		--x-offset: 385.13;
		--y: 186.02;
		--hover-tx: 13px;
		--hover-ty: -11px;
	}
	.bg-el.paper6 {
		--x-offset: 267.03;
		--y: 515.94;
		--hover-tx: 11px;
		--hover-ty: 15px;
	}
	.bg-el.paper7 {
		--x-offset: 474.76;
		--y: 448.58;
		--hover-tx: 18px;
		--hover-ty: 10px;
	}

	.bg-el.flower1 {
		--x-offset: -89.54;
		--y: 456.48;
		--hover-tx: -10px;
		--hover-ty: 14px;
	}
	.bg-el.flower2 {
		--x-offset: -22.35;
		--y: 185.45;
		--hover-tx: -6px;
		--hover-ty: -13px;
	}
	.bg-el.flower3 {
		--x-offset: 126.3;
		--y: 271.4;
		--hover-tx: 9px;
		--hover-ty: -8px;
	}
	.bg-el.flower4 {
		--x-offset: 170.88;
		--y: 220.13;
		--hover-tx: 12px;
		--hover-ty: -10px;
	}
	.bg-el.flower5 {
		--x-offset: 184.96;
		--y: 440.2;
		--hover-tx: 8px;
		--hover-ty: 16px;
	}
	.bg-el.flower6 {
		--x-offset: 431.38;
		--y: 65.56;
		--hover-tx: 15px;
		--hover-ty: -12px;
	}
	.bg-el.flower7 {
		--x-offset: 571.31;
		--y: 237.15;
		--hover-tx: 17px;
		--hover-ty: 7px;
	}
	.bg-el.flower8 {
		--x-offset: 608.12;
		--y: 303.98;
		--hover-tx: 14px;
		--hover-ty: 11px;
	}

	.bg-el.dokyudo-top {
		--x-offset: -100;
		--y: 239;
		--spread-multiplier: 1 !important;
	}
	.bg-el.dokyudo-middle {
		--x-offset: -100;
		--y: 239;
		--spread-multiplier: 1 !important;
	}
	.bg-el.dokyudo-bottom {
		--x-offset: -141;
		--y: 185;
		--spread-multiplier: 1 !important;
	}

	.hero-text-container {
		position: absolute;
		left: 50%;
		top: 589px;
		transform: translateX(-50%);
		z-index: 100;
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		pointer-events: none;
	}

	.hero-text-container > * {
		pointer-events: auto;
	}

	.hero-headline {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(2.25rem, 5vw, var(--t-h-1));
		color: var(--color-dk-cream);
		line-height: 1;
		letter-spacing: -0.02em;
		text-align: center;
		margin: 0 0 40px 0;
	}

	.highlight-meaning {
		font-family: var(--font-display);
		font-weight: 500;
		font-style: italic;
		color: var(--color-dk-copper);
	}

	.hero-ctas {
		display: flex;
		gap: 12px;
	}

	.btn-primary:focus-visible,
	.btn-outline:focus-visible {
		outline: 2px solid var(--dk-copper);
		outline-offset: 2px;
	}


</style>
