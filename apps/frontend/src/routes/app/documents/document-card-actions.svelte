<script lang="ts">
	import { scale } from 'svelte/transition';
	import MxIcon from '$lib/components/icons/MxIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	let {
		id,
		onPreview,
		onDownload,
		onDelete
	}: {
		id: string;
		onPreview?: () => void;
		onDownload?: () => void;
		onDelete?: () => void;
	} = $props();

	let menuOpen = $state(false);
	let menuPos = $state({ x: 0, y: 0 });

	function toggleMenu(e: MouseEvent) {
		if (menuOpen) {
			menuOpen = false;
			return;
		}
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		menuPos = { x: rect.right - 160, y: rect.bottom + 4 };
		menuOpen = true;
	}

	function closeMenu() {
		menuOpen = false;
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
					class="relative size-8 cursor-pointer rounded-full text-white/60 transition-[background-color,color,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-px hover:bg-white/10 focus-visible:bg-white/10 focus-visible:text-white"
					onclick={toggleMenu}
					aria-haspopup="menu"
					aria-expanded={menuOpen}
				>
					<span class="sr-only">Open menu</span>
					<MxIcon name="menu-dots-outline" class="rotate-90" />
				</Button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content
			class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
		>
			<p>Document actions</p>
		</Tooltip.Content>
	</Tooltip.Root>
</Tooltip.Provider>

{#if menuOpen}
	<div
		role="presentation"
		class="fixed inset-0 z-50 bg-transparent"
		onclick={closeMenu}
		onkeydown={closeMenu}
	></div>
	<div
		transition:scale={{ duration: 150, start: 0.95 }}
		style={`position: fixed; top: ${menuPos.y}px; left: ${menuPos.x}px;`}
		class="z-50 w-40 rounded-xl border border-white/15 bg-[#232323]/95 p-1 text-white shadow-2xl backdrop-blur-2xl"
	>
		<button
			type="button"
			class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white"
			onclick={() => {
				closeMenu();
				onPreview?.();
			}}
		>
			<MxIcon name="security-eye-outline" class="size-3.5 text-white/60" />
			<span>Preview</span>
		</button>
		<button
			type="button"
			class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white"
			onclick={() => {
				closeMenu();
				onDownload?.();
			}}
		>
			<MxIcon name="arrows-action-import-outline" class="size-3.5 text-white/60" />
			<span>Download</span>
		</button>
		<div class="my-1 h-px bg-white/10"></div>
		<button
			type="button"
			class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 focus:bg-red-500/10 focus:text-red-300 focus:outline-none active:bg-red-500/15"
			onclick={() => {
				closeMenu();
				onDelete?.();
			}}
		>
			<MxIcon name="trash-bin-minimalistic-outline" class="size-3.5 shrink-0 text-red-400" />
			<span>Delete</span>
		</button>
	</div>
{/if}
