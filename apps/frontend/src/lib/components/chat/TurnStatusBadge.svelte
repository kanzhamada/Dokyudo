<script lang="ts">
	import { ShieldAlert } from 'lucide-svelte';
	import MxIcon from '$lib/components/icons/MxIcon.svelte';
	import type { TurnStatus } from '$lib/types/rag.types';

	interface Props {
		/** Terminal status to render. Anything else (complete/processing/null) renders nothing. */
		status?: TurnStatus | null;
		/**
		 * Detailed copy for the private chat (includes regenerate hint).
		 * The public share page passes false for plain copy.
		 */
		detailed?: boolean;
	}

	let { status = null, detailed = false }: Props = $props();

	const message = $derived(
		status === 'stopped'
			? 'Response Stopped'
			: status === 'failed'
				? detailed
					? 'Response failed — regenerate or edit the question above'
					: 'Response failed'
				: status === 'blocked'
					? 'Response blocked by security filter'
					: ''
	);
</script>

{#if status === 'stopped' || status === 'failed' || status === 'blocked'}
	<div
		class="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/50"
	>
		{#if status === 'stopped'}
			<MxIcon name="video-stop-twotone" class="size-3" />
		{:else if status === 'failed'}
			<MxIcon name="danger-triangle-outline" class="size-3" />
		{:else}
			<ShieldAlert class="size-3" />
		{/if}
		<span>{message}</span>
	</div>
{/if}
