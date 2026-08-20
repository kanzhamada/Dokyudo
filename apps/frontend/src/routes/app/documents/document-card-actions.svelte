<script lang="ts">
	import { scale } from 'svelte/transition';
	import MxIcon from '$lib/components/icons/MxIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	let {
		id,
		onAskInChat,
		onPreview,
		onDownload,
		onRename,
		onDelete,
		/** Ask in Chat unavailable while the file is still being processed */
		askDisabled = false,
		/** Preview unavailable while the file is still being processed —
		 * only non-PDF files are disabled; PDFs render from the raw file. */
		previewDisabled = false
	}: {
		id: string;
		onAskInChat?: () => void;
		onPreview?: () => void;
		onDownload?: () => void;
		onRename?: () => void;
		onDelete?: () => void;
		askDisabled?: boolean;
		previewDisabled?: boolean;
	} = $props();

	let menuOpen = $state(false);
	let menuPos = $state({ x: 0, y: 0 });

	function triggerHaptic(duration = 20) {
		if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
			try {
				navigator.vibrate(duration);
			} catch {
				// Unsupported
			}
		}
	}

	function toggleMenu(e: MouseEvent) {
		triggerHaptic(15);
		if (menuOpen) {
			menuOpen = false;
			return;
		}
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const width = 160;
		const height = 240;
		const padding = 12;
		const maxX = Math.max(padding, window.innerWidth - width - padding);
		const x = Math.min(Math.max(rect.right - width, padding), maxX);
		const opensBelow = rect.bottom + 4 + height <= window.innerHeight - padding;
		const y = opensBelow
			? rect.bottom + 4
			: Math.max(padding, rect.top - height - 4);
		menuPos = { x, y };
		menuOpen = true;
	}

	function closeMenu() {
		menuOpen = false;
	}

	function teleport(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
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
					class="relative size-11 cursor-pointer select-none rounded-full text-white/60 transition-all duration-150 hover:bg-white/10 active:scale-[0.88] focus-visible:bg-white/10 focus-visible:text-white aria-expanded:bg-white/10 aria-expanded:text-white md:size-8"
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
		use:teleport
		role="presentation"
		class="fixed inset-0 z-50 bg-transparent"
		onclick={closeMenu}
		onkeydown={closeMenu}
	></div>
	<div
		use:teleport
		transition:scale={{ duration: 150, start: 0.95 }}
		style={`position: fixed; top: ${menuPos.y}px; left: ${menuPos.x}px;`}
		class="z-50 w-40 rounded-xl border border-white/15 bg-offblack/95 p-1 text-white shadow-2xl backdrop-blur-2xl"
	>
		<button
			type="button"
			class="flex min-h-11 w-full cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:text-white/30 disabled:hover:bg-transparent md:min-h-0"
			disabled={askDisabled}
			onclick={() => {
				triggerHaptic(15);
				closeMenu();
				onAskInChat?.();
			}}
		>
			<MxIcon name="chat-round-line-linear" class="size-3.5 text-white/60" />
			<span>Ask in Chat</span>
			{#if askDisabled}
				<span class="ml-auto shrink-0 text-[10px] text-white/30">Preparing…</span>
			{/if}
		</button>
		<button
			type="button"
			class="flex min-h-11 w-full cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:text-white/30 disabled:hover:bg-transparent md:min-h-0"
			disabled={previewDisabled}
			onclick={() => {
				triggerHaptic(15);
				closeMenu();
				onPreview?.();
			}}
		>
			<MxIcon name="security-eye-outline" class="size-3.5 text-white/60" />
			<span>Preview</span>
			{#if previewDisabled}
				<span class="ml-auto shrink-0 text-[10px] text-white/30">Preparing…</span>
			{/if}
		</button>
		<button
			type="button"
			class="flex min-h-11 w-full cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-[0.98] md:min-h-0"
			onclick={() => {
				triggerHaptic(15);
				closeMenu();
				onDownload?.();
			}}
		>
			<MxIcon name="arrows-action-import-outline" class="size-3.5 text-white/60" />
			<span>Download</span>
		</button>
		<button
			type="button"
			class="flex min-h-11 w-full cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-[0.98] md:min-h-0"
			onclick={() => {
				triggerHaptic(15);
				closeMenu();
				onRename?.();
			}}
		>
			<MxIcon name="edit2-outline" class="size-3.5 text-white/60" />
			<span>Rename</span>
		</button>
		<div class="my-1 h-px bg-white/10"></div>
		<button
			type="button"
			class="flex min-h-11 w-full cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-red-400 transition-all duration-150 hover:bg-red-500/10 hover:text-red-300 focus:bg-red-500/10 focus:text-red-300 focus:outline-none active:scale-[0.98] active:bg-red-500/15 md:min-h-0"
			onclick={() => {
				triggerHaptic(15);
				closeMenu();
				onDelete?.();
			}}
		>
			<MxIcon name="trash-bin-minimalistic-outline" class="size-3.5 shrink-0 text-red-400" />
			<span>Delete</span>
		</button>
	</div>
{/if}

<style>
	:global(button),
	:global(a) {
		-webkit-tap-highlight-color: rgba(255, 255, 255, 0.08);
		-webkit-touch-callout: none;
		touch-action: manipulation;
	}
</style>
