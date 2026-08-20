<script lang="ts">
	import { Check } from 'lucide-svelte';
	import MxIcon from '$lib/components/icons/MxIcon.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { toast } from 'svelte-sonner';

	interface Props {
		url?: string;
		variant?: 'desktop' | 'mobile';
	}

	let { url = '', variant = 'desktop' }: Props = $props();
	let copied = $state(false);

	async function copyShareLink() {
		try {
			const targetUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
			if (targetUrl) {
				await navigator.clipboard.writeText(targetUrl);
				copied = true;
				toast.success('Share link copied to clipboard');
				setTimeout(() => {
					copied = false;
				}, 1500);
			}
		} catch {
			toast.error('Failed to copy share link');
		}
	}
</script>

<Tooltip.Provider delayDuration={100}>
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<button
					{...props}
					type="button"
					class={variant === 'mobile'
						? 'flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/55 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-90 active:bg-white/20 active:text-white'
						: 'flex size-8 cursor-pointer items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/10 hover:text-white'}
					onclick={copyShareLink}
					aria-label="Copy share link"
				>
					{#if copied}
						<Check class="size-4 text-green-400" />
					{:else}
						<MxIcon name="share-outline" class="size-4" />
					{/if}
				</button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content
			class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
		>
			<p>{copied ? 'Copied!' : 'Copy link'}</p>
		</Tooltip.Content>
	</Tooltip.Root>
</Tooltip.Provider>
