<script lang="ts">
	import * as Tooltip from '$lib/components/ui/tooltip';

	let { href, tooltipText }: { href: string; tooltipText: string } = $props();
</script>

<Tooltip.Provider>
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<a
					{...props}
					{href}
					class="absolute top-6 left-6 flex cursor-pointer items-center justify-center rounded-md p-1.5 text-white transition-colors hover:bg-white/10 md:top-8 md:left-8"
					aria-label={tooltipText}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="22"
						height="22"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="m12 19-7-7 7-7" />
						<path d="M19 12H5" />
					</svg>
				</a>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content>{tooltipText}</Tooltip.Content>
	</Tooltip.Root>
</Tooltip.Provider>
