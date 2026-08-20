<script lang="ts">
	import MxIcon from '$lib/components/icons/MxIcon.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { toast } from 'svelte-sonner';
	import { stripMentionTokens } from '$lib/utils/doc-mentions';

	interface Props {
		text?: string;
		label?: string;
		class?: string;
		iconSize?: string;
	}

	let {
		text = '',
		label = 'Copy',
		class: className = 'h-7 w-7 cursor-pointer text-white/40 hover:bg-white/10 hover:text-white',
		iconSize = 'size-3.5'
	}: Props = $props();

	let copied = $state(false);

	async function handleCopy() {
		const cleanText = stripMentionTokens(text.replace(/\s*\[Doc [^\]]+\]/gi, '')).trim();
		try {
			await navigator.clipboard.writeText(cleanText);
			copied = true;
			toast.success('Copied to clipboard');
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch {
			toast.error('Failed to copy to clipboard');
		}
	}
</script>

<Tooltip.Provider delayDuration={100}>
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					variant="ghost"
					size="icon"
					class={className}
					onclick={handleCopy}
					aria-label={label}
				>
					{#if copied}
					<MxIcon name="check-square-outline" class="{iconSize} text-green-400" />
				{:else}
					<MxIcon name="copy-outline" class={iconSize} />
				{/if}
				</Button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content
			class="rounded-md border-0 bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
		>
			<p>{copied ? 'Copied!' : label}</p>
		</Tooltip.Content>
	</Tooltip.Root>
</Tooltip.Provider>
