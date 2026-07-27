<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import gsap from 'gsap';

	// Dynamically import all SVG files in the directory
	const svgModules = import.meta.glob('$lib/assets/svg/*.svg', {
		eager: true,
		query: '?url',
		import: 'default'
	});
	const logos = Object.values(svgModules) as string[];

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
						filter: 'grayscale(0%)',
						color: '#ffffff',
						duration: 0.3
					});
				});
				item.addEventListener('mouseleave', () => {
					gsap.to(item, {
						opacity: 0.5,
						filter: 'grayscale(100%)',
						color: 'var(--color-dk-muted-gray)',
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

<div bind:this={container} class="relative z-[100] flex w-full justify-center px-6">
	<div class="mb-4 flex w-full max-w-4xl flex-col items-stretch overflow-hidden rounded-[6px]   bg-[#242323]  md:flex-row">
		<div class="flex flex-1 min-w-0 flex-col items-center gap-4 px-6 py-6 md:h-14 md:flex-row md:gap-8 md:py-0 overflow-hidden">
			<span class="shrink-0 whitespace-nowrap font-sans text-[11px] font-semibold uppercase tracking-[0.05em] text-dk-muted-gray">
				Build With
			</span>
			<div class="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]">
				<div class="marquee-track flex w-max items-center gap-10 pr-10">
					{#each [1, 2] as _}
						{#each logos as logo}
							<div class="logo-item flex cursor-default items-center text-dk-muted-gray opacity-50 grayscale">
								<img src={logo} alt="Technology Logo" class="block h-6 w-6 object-contain" />
							</div>
						{/each}
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>
