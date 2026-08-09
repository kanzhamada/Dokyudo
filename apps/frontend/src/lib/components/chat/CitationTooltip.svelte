<script lang="ts">
	import * as Tooltip from '$lib/components/ui/tooltip';

	interface Props {
		/** The inline citation chip element ([data-doc-id]) this tooltip is attached to. */
		trigger: HTMLElement;
	}

	let { trigger }: Props = $props();

	let docTitle = $state('');
	let snippet = $state('');

	$effect(() => {
		docTitle = trigger.getAttribute('data-doc-title') || trigger.textContent?.trim() || '';
		snippet = trigger.getAttribute('data-snippet') || '';
	});
</script>

<!--
	Bridge between a citation chip rendered via `{@html}` (markdown) and the shadcn
	Tooltip component. The component is mounted inside the chip element, so the
	invisible overlay button covers exactly the chip and acts as the tooltip
	trigger — positioning, delay, and hover handling are all provided by bits-ui
	via the shadcn Tooltip components. The tooltip content portals to document.body.
-->
<Tooltip.Provider delayDuration={100}>
	<Tooltip.Root>
		<Tooltip.Trigger
			class="absolute inset-0 cursor-pointer opacity-0"
			aria-label={docTitle || 'Citation'}
		/>
		<Tooltip.Content
			class="max-w-xs rounded-md border-0 bg-white px-3 py-1.5 text-xs text-black shadow-md"
		>
			<p class="font-semibold text-black">{docTitle}</p>
			{#if snippet}
				<p class="mt-1 text-black/70 italic">"{snippet}"</p>
			{/if}
		</Tooltip.Content>
	</Tooltip.Root>
</Tooltip.Provider>
