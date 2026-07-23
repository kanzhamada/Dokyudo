<script lang="ts">
	import { useSidebar } from '$lib/components/ui/sidebar/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import Menu from '@lucide/svelte/icons/menu';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import favicon from '$lib/assets/favicon.svg?raw';
	import { mobileHeaderState } from '$lib/state/mobile-header.svelte.js';

	const sidebar = useSidebar();
</script>

<header
	class="fixed inset-x-4 top-4 z-50 flex animate-slide-down flex-col justify-center overflow-hidden rounded-[24px] border shadow-lg backdrop-blur-[42px] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] md:hidden {mobileHeaderState.type ===
	'error'
		? 'h-auto min-h-14 border-red-500/50 bg-red-950/[0.60] px-4 py-3'
		: mobileHeaderState.type === 'success'
			? 'h-auto min-h-14 border-green-500/50 bg-green-950/[0.60] px-4 py-3'
			: 'h-14 border-white/[0.16] bg-[#232323]/[0.40] px-4'}"
>
	{#if mobileHeaderState.type === 'default'}
		<div class="flex h-full w-full items-center justify-between">
			<Button
				variant="ghost"
				size="icon"
				class="-ml-2 cursor-pointer text-white hover:bg-white/10 hover:text-white"
				onclick={() => sidebar.toggle()}
			>
				<Menu class="size-6" />
				<span class="sr-only">Toggle Sidebar</span>
			</Button>

			<div class="flex items-center gap-0.5">
				<div class="flex items-center [&_path]:fill-white [&>svg]:size-6">
					{@html favicon}
				</div>
				<span class="font-geist text-lg font-bold tracking-tight text-white">okyudo</span>
			</div>
		</div>
	{:else if mobileHeaderState.type === 'error'}
		<div class="flex w-full items-start gap-3">
			<TriangleAlert class="mt-0.5 size-5 shrink-0 text-red-400" />
			<div class="flex flex-col">
				<span class="text-sm font-semibold text-white">{mobileHeaderState.title || 'Error'}</span>
				<span class="text-sm leading-snug text-red-200">{mobileHeaderState.message}</span>
			</div>
		</div>
	{:else if mobileHeaderState.type === 'success'}
		<div class="flex w-full items-start gap-3">
			<CircleCheck class="mt-0.5 size-5 shrink-0 text-green-400" />
			<div class="flex flex-col">
				<span class="text-sm font-semibold text-white">{mobileHeaderState.title || 'Success'}</span>
				<span class="text-sm leading-snug text-green-200">{mobileHeaderState.message}</span>
			</div>
		</div>
	{/if}
</header>
