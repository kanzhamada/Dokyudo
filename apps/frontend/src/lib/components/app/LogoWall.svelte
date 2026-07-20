<script lang="ts">
	// Dynamically import all SVG files in the directory
	const svgModules = import.meta.glob('$lib/assets/svg/*.svg', {
		eager: true,
		query: '?url',
		import: 'default'
	});
	const logos = Object.values(svgModules) as string[];
</script>

<div class="relative z-[100] flex w-full justify-center px-6">
	<div class="mb-4 flex w-full max-w-4xl flex-col items-stretch overflow-hidden rounded-[24px] border border-white/16 bg-[#232323]/40 shadow-lg backdrop-blur-[42px] md:flex-row">
		<div class="flex flex-1 min-w-0 flex-col items-center gap-4 px-6 py-6 md:h-14 md:flex-row md:gap-8 md:py-0 overflow-hidden">
			<span class="shrink-0 whitespace-nowrap font-sans text-[11px] font-semibold uppercase tracking-[0.05em] text-[#8e8e8e]">
				Build With
			</span>
			<div class="relative w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]">
				<div class="flex w-max items-center gap-10 pr-10 hover:[animation-play-state:paused] animate-scroll">
					{#each [1, 2] as _}
						{#each logos as logo}
							<div class="flex cursor-default items-center text-[#8e8e8e] opacity-50 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0 hover:text-white">
								<img src={logo} alt="Technology Logo" class="block h-6 w-6 object-contain" />
							</div>
						{/each}
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>
