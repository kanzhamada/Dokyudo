<script lang="ts">
	import type { Snippet } from 'svelte';
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
	class="absolute inset-x-4 top-4 z-50 flex flex-col justify-center overflow-hidden rounded-[24px] border shadow-lg backdrop-blur-[42px] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] md:hidden {mobileHeaderState.type ===
	'error'
		? 'h-auto min-h-14 border-red-500/50 bg-red-950/[0.60] px-4 py-3'
		: mobileHeaderState.type === 'success'
			? 'h-auto min-h-14 border-green-500/50 bg-green-950/[0.60] px-4 py-3'
			: mobileHeaderState.type === 'info'
				? 'h-auto min-h-14 border-blue-500/50 bg-blue-950/[0.60] px-4 py-3'
				: bottom
					? 'h-auto min-h-14 border-white/[0.16] bg-[#232323]/[0.40] px-3'
					: 'h-14 border-white/[0.16] bg-[#232323]/[0.40] px-4'} {className}"
>
	{#if mobileHeaderState.type === 'error'}
		<div class="flex w-full items-start gap-3">
			<MxIcon name="danger-triangle-outline" class="mt-0.5 size-5 shrink-0 text-red-400" />
			<div class="flex flex-col">
				<span class="text-sm font-semibold text-white">{mobileHeaderState.title || 'Error'}</span>
				{#if mobileHeaderState.message}
					<span class="text-sm leading-snug text-red-200">{mobileHeaderState.message}</span>
				{/if}
			</div>
		</div>
	{:else if mobileHeaderState.type === 'success'}
		<div class="flex w-full items-start gap-3">
			<CircleCheck class="mt-0.5 size-5 shrink-0 text-green-400" />
			<div class="flex flex-col">
				<span class="text-sm font-semibold text-white">{mobileHeaderState.title || 'Success'}</span>
				{#if mobileHeaderState.message}
					<span class="text-sm leading-snug text-green-200">{mobileHeaderState.message}</span>
				{/if}
			</div>
		</div>
	{:else if mobileHeaderState.type === 'info'}
		<div class="flex w-full items-start gap-3">
			<Info class="mt-0.5 size-5 shrink-0 text-blue-400" />
			<div class="flex flex-col">
				<span class="text-sm font-semibold text-white">{mobileHeaderState.title || 'Info'}</span>
				{#if mobileHeaderState.message}
					<span class="text-sm leading-snug text-blue-200">{mobileHeaderState.message}</span>
				{/if}
			</div>
		</div>
	{:else if children}
		{@render children()}
	{:else}
		<div
			class="flex h-14 w-full items-center justify-between {leading || center || trailing
				? 'px-0'
				: ''}"
		>
			<div class="flex items-center gap-1">
				{#if leading}
					{@render leading()}
				{:else}
					<Button
						variant="ghost"
						size="icon"
						class="-ml-2 cursor-pointer text-white transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-90 active:bg-white/15 active:text-white"
						onclick={() => sidebar?.toggle()}
					>
						<MxIcon name="hamburger-menu-outline" class="size-6" />
						<span class="sr-only">Toggle Sidebar</span>
					</Button>
				{/if}
			</div>

			{#if center}
				{@render center()}
			{/if}

			<div class="flex items-center gap-1">
				{#if trailing}
					{@render trailing()}
				{:else}
					<div class="flex items-center gap-0.5">
						<div class="flex items-center [&_path]:fill-white [&>svg]:size-6">
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							{@html favicon}
						</div>
						<span class="font-geist text-lg font-bold tracking-tight text-white">okyudo</span>
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
