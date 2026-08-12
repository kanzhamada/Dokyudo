<script lang="ts">
	import MxIcon from '$lib/components/icons/MxIcon.svelte';

	export interface AttachmentCardItem {
		name: string;
		documentId?: string;
	}

	interface Props {
		attachments: AttachmentCardItem[];
		/**
		 * true = clickable cards with hover affordance that call onPreview
		 * (private chat opens the document preview); false = static cards
		 * (public share page has no document access).
		 */
		interactive?: boolean;
		/** Only used when interactive — fired with the card's document id + name. */
		onPreview?: (documentId: string, name: string) => void;
	}

	let { attachments = [], interactive = false, onPreview }: Props = $props();

	/** Splits a filename into a display base and its extension ("laporan.pdf" → laporan / pdf). */
	function splitExt(name: string): { base: string; ext: string | null } {
		const dot = name.lastIndexOf('.');
		if (dot > 0 && dot < name.length - 1) {
			return { base: name.slice(0, dot), ext: name.slice(dot + 1) };
		}
		return { base: name, ext: null };
	}
</script>

{#if attachments.length > 0}
	<div class="flex flex-wrap justify-end gap-2">
		{#each attachments as att (att.documentId ?? att.name)}
			{@const { base, ext } = splitExt(att.name)}
			<div class="flex w-20 flex-col items-center gap-1.5">
				{#if interactive && att.documentId}
					<button
						type="button"
						class="flex aspect-square w-full cursor-pointer items-center justify-center rounded-xl border border-white/15 bg-white/5 transition-colors hover:border-white/30 hover:bg-white/10"
						title="Open {att.name} in PDF viewer"
						onclick={() => onPreview?.(att.documentId!, att.name)}
					>
						<MxIcon name="document-outline" class="size-8 text-white/70" />
					</button>
				{:else}
					<div
						class="flex aspect-square w-full items-center justify-center rounded-xl border border-white/15 bg-white/5"
					>
						<MxIcon name="document-outline" class="size-8 text-white/70" />
					</div>
				{/if}
				<div class="w-full min-w-0 text-center">
					<p class="truncate text-[11px] leading-tight text-white/80" title={att.name}>{base}</p>
					{#if ext}
						<span class="text-[10px] leading-tight text-white/40">.{ext}</span>
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/if}
