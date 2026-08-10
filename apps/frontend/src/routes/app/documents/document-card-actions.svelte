<script lang="ts">
	import MxIcon from '$lib/components/icons/MxIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
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
</script>

<DropdownMenu.Root>
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props: tooltipProps })}
				<DropdownMenu.Trigger>
					{#snippet child({ props: dropdownProps })}
						<Button
							{...tooltipProps}
							{...dropdownProps}
							variant="ghost"
							size="icon"
							class="relative size-8 cursor-pointer rounded-full text-white/60 transition-[background-color,color,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-px hover:bg-white/10 focus-visible:bg-white/10 focus-visible:text-white data-[state=open]:bg-white/10"
						>
							<span class="sr-only">Open menu</span>
							<MxIcon name="menu-dots-outline" class="rotate-90" />
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content
			class="rounded-full border border-black/10 bg-white px-2 py-1 text-xs text-black shadow-none"
		>
			<p>Document actions</p>
		</Tooltip.Content>
	</Tooltip.Root>

	<DropdownMenu.Content
		align="end"
		class="w-40 rounded-xl border border-white/15 bg-[#232323]/95 p-1 text-white shadow-2xl backdrop-blur-2xl"
	>
		<DropdownMenu.Group>
			<DropdownMenu.Item
				class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white"
				onclick={onPreview}
			>
				<MxIcon name="security-eye-outline" class="size-3.5 text-white/60" />
				<span>Preview</span>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white"
				onclick={onDownload}
			>
				<MxIcon name="arrows-action-import-outline" class="size-3.5 text-white/60" />
				<span>Download</span>
			</DropdownMenu.Item>
			<DropdownMenu.Separator class="my-1 h-px bg-white/10" />
			<DropdownMenu.Item
				class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 focus:bg-red-500/10 focus:text-red-300 focus:outline-none active:bg-red-500/15"
				onclick={onDelete}
			>
				<MxIcon name="trash-bin-minimalistic-outline" class="size-3.5 shrink-0 text-red-400" />
				<span>Delete</span>
			</DropdownMenu.Item>
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu.Root>
