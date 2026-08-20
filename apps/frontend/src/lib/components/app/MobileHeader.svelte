<script lang="ts">
	import type { Snippet } from 'svelte';
	import { scale } from 'svelte/transition';
	import { useSidebar } from '$lib/components/ui/sidebar/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import MxIcon from '$lib/components/icons/MxIcon.svelte';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Info from '@lucide/svelte/icons/info';
	import favicon from '$lib/assets/favicon.svg?raw';
	import { mobileHeaderState } from '$lib/state/mobile-header.svelte.js';

	interface Props {
		class?: string;
		children?: Snippet;
		leading?: Snippet;
		center?: Snippet;
		trailing?: Snippet;
		bottom?: Snippet;
	}

	let { class: className = '', children, leading, center, trailing, bottom }: Props = $props();

	const sidebar = useSidebar();
</script>

<header
	class="absolute inset-x-4 top-4 z-50 flex flex-col justify-center overflow-hidden rounded-[24px] border border-white/[0.16] bg-[#232323]/[0.40] shadow-lg backdrop-blur-[42px] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] md:hidden {bottom
		? 'h-auto min-h-14 px-3'
		: 'h-14 px-3'} {className}"
>
	{#if children}
		{@render children()}
	{:else}
		<div
			class="flex h-14 w-full items-center justify-between gap-2 {leading || center || trailing
				? 'px-0'
				: ''}"
		>
			<!-- Leading slot -->
			<div class="flex shrink-0 items-center gap-1">
				{#if leading}
					{@render leading()}
				{:else}
					<Button
						variant="ghost"
						size="icon"
						class="-ml-1 size-9 cursor-pointer text-white/70 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-90 active:bg-white/20 active:text-white"
						onclick={() => sidebar?.toggle()}
					>
						<MxIcon name="hamburger-menu-outline" class="size-5" />
						<span class="sr-only">Toggle Sidebar</span>
					</Button>
				{/if}
			</div>

			<!-- Center slot: Dynamic message pill or page center snippet -->
			<div class="flex min-w-0 flex-1 items-center justify-center">
				{#if mobileHeaderState.type === 'success'}
					<div
						transition:scale={{ duration: 200, start: 0.92 }}
						class="flex max-w-full items-center gap-2 rounded-xl border border-[#2e6844] bg-[#223f2b] px-3 py-1.5 shadow-sm backdrop-blur-md"
					>
						<CircleCheck class="size-4 shrink-0 text-[#22c55e]" />
						<span class="truncate text-xs font-medium text-white sm:text-sm">
							{mobileHeaderState.title || 'Success'}
						</span>
						{#if mobileHeaderState.message}
							<span class="hidden truncate text-xs text-green-200/80 sm:inline">
								{mobileHeaderState.message}
							</span>
						{/if}
					</div>
				{:else if mobileHeaderState.type === 'error'}
					<div
						transition:scale={{ duration: 200, start: 0.92 }}
						class="flex max-w-full items-center gap-2 rounded-xl border border-red-500/40 bg-[#3a1d1d] px-3 py-1.5 shadow-sm backdrop-blur-md"
					>
						<MxIcon name="danger-triangle-outline" class="size-4 shrink-0 text-red-400" />
						<span class="truncate text-xs font-medium text-white sm:text-sm">
							{mobileHeaderState.title || mobileHeaderState.message || 'Error'}
						</span>
						{#if mobileHeaderState.message && mobileHeaderState.title !== mobileHeaderState.message}
							<span class="hidden truncate text-xs text-red-200/80 sm:inline">
								{mobileHeaderState.message}
							</span>
						{/if}
					</div>
				{:else if mobileHeaderState.type === 'info'}
					<div
						transition:scale={{ duration: 200, start: 0.92 }}
						class="flex max-w-full items-center gap-2 rounded-xl border border-blue-500/40 bg-[#1d2a3a] px-3 py-1.5 shadow-sm backdrop-blur-md"
					>
						<Info class="size-4 shrink-0 text-blue-400" />
						<span class="truncate text-xs font-medium text-white sm:text-sm">
							{mobileHeaderState.title || 'Info'}
						</span>
						{#if mobileHeaderState.message}
							<span class="hidden truncate text-xs text-blue-200/80 sm:inline">
								{mobileHeaderState.message}
							</span>
						{/if}
					</div>
				{:else if center}
					{@render center()}
				{/if}
			</div>

			<!-- Trailing slot -->
			<div class="flex shrink-0 items-center gap-1">
				{#if trailing}
					{@render trailing()}
				{:else}
					<div class="flex items-center gap-0.5 pr-1">
						<div class="flex items-center [&_path]:fill-white [&>svg]:size-5">
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							{@html favicon}
						</div>
						<span class="font-geist text-base font-bold tracking-tight text-white">okyudo</span>
					</div>
				{/if}
			</div>
		</div>

		{#if bottom}
			{@render bottom()}
		{/if}
	{/if}
</header>

<style>
	:global(header button),
	:global(header a) {
		-webkit-tap-highlight-color: rgba(255, 255, 255, 0.08);
		-webkit-touch-callout: none;
		user-select: none;
		touch-action: manipulation;
	}
</style>
