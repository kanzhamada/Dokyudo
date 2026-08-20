<script lang="ts">
	import * as Tooltip from '$lib/components/ui/tooltip';

	let { href, tooltipText }: { href: string; tooltipText: string } = $props();
</script>

<Tooltip.Provider>
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<a {...props} {href} class="auth-back-button" aria-label={tooltipText}>
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
		<Tooltip.Content
			class="border-white/[0.16] bg-graphite text-white"
			arrowClasses="bg-graphite border-none"
		>
			{tooltipText}</Tooltip.Content
		>
	</Tooltip.Root>
</Tooltip.Provider>
