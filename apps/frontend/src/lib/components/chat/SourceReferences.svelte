<script lang="ts">
	import { BookOpen } from 'lucide-svelte';
	import MxIcon from '$lib/components/icons/MxIcon.svelte';

	import * as Tooltip from '$lib/components/ui/tooltip';

	export interface SourceRef {
		id?: string;
		name: string;
		pages?: number[];
		page?: string | number;
		snippet?: string | null;
	}

	interface Props {
		references: SourceRef[];
		/**
		 * true = clickable chips with hover affordance that call onPreview
		 * (private chat page opens the document preview); false = static chips
		 * (public share page has no document access).
		 */
		interactive?: boolean;
		/** Only used when interactive — fired with the clicked reference. */
		onPreview?: (ref: SourceRef) => void;
	}

	let { references = [], interactive = false, onPreview }: Props = $props();
</script>

{#if references.length > 0}
	<div class="mt-2 border-t border-white/10 pt-3">
		<div class="mb-2 flex items-center gap-1.5 text-xs font-medium text-white/60">
			<BookOpen class="size-3.5 text-white/60" />
			<span>Source References ({references.length})</span>
		</div>
		<div class="flex flex-wrap gap-2">
			{#each references as ref (ref.id ?? ref.name)}
				<Tooltip.Provider delayDuration={100}>
					<Tooltip.Root>
						<Tooltip.Trigger
							class="flex items-center gap-1.5 rounded-full border border-white/15 bg-offblack px-3 py-1 text-xs text-white/80 {interactive
								? 'cursor-pointer transition-colors hover:border-white/30 hover:bg-graphite hover:text-white'
								: ''}"
							onclick={interactive ? () => onPreview?.(ref) : undefined}
						>
							<MxIcon name="document-outline" class="size-3 text-white/60" />
							<span class="font-medium">{ref.name}</span>
							{#if ref.pages && ref.pages.length > 0}
								<span class="text-white/40">• {ref.pages.join(', ')}</span>
							{:else if ref.page}
								<span class="text-white/40">• {String(ref.page)}</span>
							{/if}
						</Tooltip.Trigger>
						<Tooltip.Content
							class="max-w-xs rounded-md border-0 bg-white px-3 py-1.5 text-xs text-black shadow-md"
						>
							<p class="font-semibold text-black">{ref.name}</p>
							{#if ref.snippet}
								<p class="mt-1 text-black/70 italic">"{ref.snippet}"</p>
							{/if}
						</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>
			{/each}
		</div>
	</div>
{/if}
