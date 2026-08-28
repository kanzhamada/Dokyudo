<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { gsap } from 'gsap';

	let {
		displayName = 'User',
		onComplete
	}: {
		displayName?: string;
		onComplete?: () => void;
	} = $props();

	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				if (node.parentNode) {
					node.parentNode.removeChild(node);
				}
			}
		};
	}

	let overlayEl: HTMLDivElement;
	let f1: HTMLHeadingElement;
	let f2: HTMLHeadingElement;
	let f3: HTMLHeadingElement;
	let f4: HTMLHeadingElement;
	let f5: HTMLHeadingElement;
	let f6: HTMLHeadingElement;
	let logoEl: HTMLDivElement;

	let timeline: gsap.core.Timeline | null = null;

	onMount(() => {
		// Initialize starting visual properties
		gsap.set([f1, f2, f3, f4, f5, f6], {
			opacity: 0,
			scale: 0.92,
			y: 18
		});

		gsap.set(logoEl, {
			opacity: 0,
			scale: 4.8
		});

		const tl = gsap.timeline({
			onComplete: () => {
				onComplete?.();
			}
		});
		timeline = tl;

		// Frame 1: "Welcome <DisplayName>!"
		tl.to(f1, {
			opacity: 1,
			scale: 1,
			y: 0,
			duration: 0.4,
			ease: 'power3.out'
		}).to(
			f1,
			{
				opacity: 0,
				scale: 1.05,
				y: -16,
				duration: 0.28,
				ease: 'power2.in'
			},
			'+=0.75'
		);

		// Frame 2: "Let's Search"
		tl.to(f2, {
			opacity: 1,
			scale: 1,
			y: 0,
			duration: 0.35,
			ease: 'power3.out'
		}).to(
			f2,
			{
				opacity: 0,
				scale: 1.05,
				y: -16,
				duration: 0.25,
				ease: 'power2.in'
			},
			'+=0.45'
		);

		// Frame 3: "Your" (Terracotta)
		tl.to(f3, {
			opacity: 1,
			scale: 1,
			y: 0,
			duration: 0.3,
			ease: 'power3.out'
		}).to(
			f3,
			{
				opacity: 0,
				scale: 1.06,
				y: -14,
				duration: 0.22,
				ease: 'power2.in'
			},
			'+=0.32'
		);

		// Frame 4: "Documents"
		tl.to(f4, {
			opacity: 1,
			scale: 1,
			y: 0,
			duration: 0.35,
			ease: 'power3.out'
		}).to(
			f4,
			{
				opacity: 0,
				scale: 1.05,
				y: -16,
				duration: 0.25,
				ease: 'power2.in'
			},
			'+=0.4'
		);

		// Frame 5: "With Meaning" (Meaning = Terracotta)
		tl.to(f5, {
			opacity: 1,
			scale: 1,
			y: 0,
			duration: 0.38,
			ease: 'power3.out'
		}).to(
			f5,
			{
				opacity: 0,
				scale: 1.05,
				y: -16,
				duration: 0.28,
				ease: 'power2.in'
			},
			'+=0.45'
		);

		// Frame 6: Logo Converge & "in Dokyudo"
		tl.to(logoEl, {
			opacity: 0.09,
			scale: 1.0,
			duration: 0.75,
			ease: 'expo.out'
		})
			.to(
				f6,
				{
					opacity: 1,
					scale: 1,
					y: 0,
					duration: 0.55,
					ease: 'power4.out'
				},
				'-=0.68'
			)
			// Hold on final frame for 2.0 seconds
			.to({}, { duration: 2.0 })
			// Slowly fade out the entire overlay wrapper
			.to(overlayEl, {
				opacity: 0,
				duration: 0.8,
				ease: 'power2.inOut'
			});
	});

	onDestroy(() => {
		if (timeline) {
			timeline.kill();
		}
	});
</script>

<div
	use:portal
	bind:this={overlayEl}
	class="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden select-none"
	style="
		background-color: var(--color-black);
		background-image: radial-gradient(circle, rgba(250, 250, 250, 0.089) 1px, transparent 1px);
		background-size: 24px 24px;
		font-family: var(--font-display);
	"
>
	<!-- Dokyudo Favicon Logo (Monochrome scale-down backdrop) -->
	<div
		bind:this={logoEl}
		class="pointer-events-none absolute top-1/2 left-1/2 z-[1] h-[380px] w-[340px] -translate-x-1/2 -translate-y-1/2 opacity-0"
	>
		<svg
			width="476"
			height="537"
			viewBox="0 0 476 537"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			class="h-full w-full"
		>
			<path
				d="M257.254 0.587891C294.051 8.946 348.053 31.5262 393.29 72.7383C439.082 114.456 476.221 175.71 476.222 259.703C476.222 362.011 435.241 431.474 386.472 475.079C338.928 517.589 283.365 535.972 252.013 535.972V488.646C269.762 488.646 314.473 475.969 354.927 439.799C394.155 404.724 428.896 347.884 428.896 259.703C428.895 191.305 399.187 142.131 361.418 107.723C324.14 73.7611 279.341 54.6272 249.267 47.3262H47.3262V486.634C80.0122 482.766 120.755 473.604 156.914 456.683C203.119 435.061 237.172 403.228 243.995 357.931L244.03 357.697L244.069 357.465C246.687 342.165 249.111 327.943 251.344 314.721H99.9775V267.395H259.165C266.58 221.004 270.263 191.414 269.912 172.288C269.712 161.386 268.154 157.399 267.642 156.361C266.771 156.014 264.101 155.22 257.634 154.978C220.532 153.586 145.849 154.397 112.825 154.99L112.4 131.331L111.975 107.671C144.813 107.081 220.787 106.236 259.407 107.685C272.381 108.171 289.294 110.409 301.796 123.476C313.981 136.211 316.91 153.956 317.23 171.42C317.626 192.951 313.921 223.888 307.097 267.395H347.258V314.721H299.352C296.722 330.342 293.843 347.185 290.737 365.335C280.399 432.939 229.746 474.853 176.974 499.548C123.916 524.376 64.0017 534.276 24.6689 535.95L0 537V0H254.667L257.254 0.587891Z"
				fill="white"
			/>
		</svg>
	</div>

	<!-- Frame 1: Welcome <DisplayName>! -->
	<div class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-center">
		<h1
			bind:this={f1}
			class="text-[clamp(48px,8vw,100px)] font-normal leading-[1.08] tracking-[-0.035em] text-white opacity-0"
		>
			Welcome <span class="text-terracotta">{displayName}</span>!
		</h1>
	</div>

	<!-- Frame 2: Let's Search -->
	<div class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-center">
		<h1
			bind:this={f2}
			class="text-[clamp(48px,8vw,100px)] font-normal leading-[1.08] tracking-[-0.035em] text-white opacity-0"
		>
			Let's Search
		</h1>
	</div>

	<!-- Frame 3: Your -->
	<div class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-center">
		<h1
			bind:this={f3}
			class="text-[clamp(48px,8vw,100px)] font-normal leading-[1.08] tracking-[-0.035em] text-terracotta opacity-0"
		>
			Your
		</h1>
	</div>

	<!-- Frame 4: Documents -->
	<div class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-center">
		<h1
			bind:this={f4}
			class="text-[clamp(48px,8vw,100px)] font-normal leading-[1.08] tracking-[-0.035em] text-white opacity-0"
		>
			Documents
		</h1>
	</div>

	<!-- Frame 5: With Meaning -->
	<div class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-center">
		<h1
			bind:this={f5}
			class="text-[clamp(48px,8vw,100px)] font-normal leading-[1.08] tracking-[-0.035em] text-white opacity-0"
		>
			With <span class="text-terracotta">Meaning</span>
		</h1>
	</div>

	<!-- Frame 6: in Dokyudo -->
	<div class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-center">
		<h1
			bind:this={f6}
			class="text-[clamp(52px,8.5vw,104px)] font-medium tracking-[-0.03em] text-white opacity-0"
		>
			<span class="mr-4 text-[0.85em] font-normal text-warm-gray italic">in</span><span
				class="text-terracotta">Dokyudo</span
			>
		</h1>
	</div>
</div>
