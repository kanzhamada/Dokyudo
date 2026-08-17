<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import gsap from 'gsap';

	// Dynamically import all SVG files in the directory
	const svgModules = import.meta.glob('$lib/assets/svg/*.svg', {
		eager: true,
		query: '?url',
		import: 'default'
	});
	const lightLogos = new Set([
		'drizzle.svg',
		'github.svg',
		'groq.svg',
		'minio.svg',
		'openai.svg',
		'shadcn.svg'
	]);
	const solidLogos = new Set(['deno.svg', 'rust.svg']);
	const logos = Object.entries(svgModules).map(([path, url]) => {
		const filename = path.split('/').pop() ?? path;
		return {
			url: url as string,
			isLight: lightLogos.has(filename),
			isSolid: solidLogos.has(filename)
		};
	});

	let container: HTMLDivElement;
	let ctx: gsap.Context;

	onMount(() => {
		ctx = gsap.context(() => {
			const tween = gsap.to('.marquee-track', {
				xPercent: -50,
				duration: 60,
				ease: 'none',
				repeat: -1
			});

			const track = container.querySelector('.marquee-track');
			if (track) {
				track.addEventListener('mouseenter', () => tween.pause());
				track.addEventListener('mouseleave', () => tween.resume());
			}

			const logoItems = container.querySelectorAll('.logo-item');
			logoItems.forEach((item) => {
				item.addEventListener('mouseenter', () => {
					gsap.to(item, {
						opacity: 1,
						duration: 0.3
					});
				});
				item.addEventListener('mouseleave', () => {
					gsap.to(item, {
						opacity: 0.5,
						duration: 0.3
					});
				});
			});
		}, container);
	});

	onDestroy(() => {
		if (ctx) ctx.revert();
	});
</script>

<!-- Logo marquee styled with the `btn--white` CTA color language
     (DESIGN.md: off-white surface, black text, terracotta hover accent). -->
<div bind:this={container} class="group relative z-[100] flex w-full justify-center px-6">
	<div class="logowall-card mb-4 flex w-full max-w-4xl items-stretch overflow-hidden rounded-[8px]">
		<div
			class="flex min-w-0 flex-1 flex-col items-center gap-4 overflow-hidden px-6 py-6 md:h-14 md:flex-row md:gap-8 md:py-0"
		>
			<span
				class="logowall-label shrink-0 text-xs font-medium tracking-[0.12em] whitespace-nowrap text-black uppercase"
			>
				Build With
			</span>
			<div
				class="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]"
			>
				<div class="marquee-track flex w-max items-center gap-10 pr-10">
					{#each [0, 1] as i (i)}
						{#each logos as logo (logo)}
							<div class="logo-item flex cursor-default items-center opacity-50">
								<img
									src={logo.url}
									alt="Technology Logo"
									class={logo.isLight
										? 'logo-image logo-image--light block h-6 w-6 object-contain'
										: logo.isSolid
											? 'logo-image logo-image--solid block h-6 w-6 object-contain'
											: 'logo-image block h-6 w-6 object-contain'}
								/>
							</div>
						{/each}
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	/* --font-interface (Space Grotesk) — DESIGN.md interface face for labels */
	.logowall-label {
		font-family: 'Space Grotesk', 'Trebuchet MS', sans-serif;
	}
	.logo-image {
		filter: grayscale(100%);
		transition: filter 300ms cubic-bezier(0.37, 0, 0.63, 1);
	}
	.logo-image--light {
		filter: grayscale(100%) brightness(0);
	}
	.logo-image--solid {
		filter: grayscale(100%) brightness(0);
	}
	.logo-item:hover .logo-image {
		filter: grayscale(0%);
	}
	.logo-item:hover .logo-image--light {
		filter: none;
	}
	.logo-item:hover .logo-image--solid {
		filter: grayscale(0%);
	}

	/* Card surface mirroring `.btn--white` (landing.css): off-white at rest,
	   white on hover — 200ms DESIGN.md motion contract. */
	.logowall-card {
		background: oklch(94.5% 0.014 85); /* --color-offwhite */
		transition: background-color 200ms cubic-bezier(0.37, 0, 0.63, 1);
	}
	.group:hover .logowall-card {
		background: #ffffff; /* --color-white */
	}
</style>
