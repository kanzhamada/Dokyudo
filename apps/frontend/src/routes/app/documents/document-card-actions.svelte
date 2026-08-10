<script lang="ts">
	import MxIcon from '$lib/components/icons/MxIcon.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';

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
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="ghost"
				size="icon"
				class="relative size-8 cursor-pointer rounded-full text-white/60 transition-[background-color,color,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-px hover:bg-white/10 focus-visible:bg-white/10 focus-visible:text-white data-[state=open]:bg-white/10"
			>
				<span class="sr-only">Open menu</span>
				<MxIcon name="menu-dots-outline" class="rotate-90" />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content
		align="end"
		class="w-40 rounded-2xl border-white/10 bg-[#2A2A2A] text-white shadow-none"
	>
		<DropdownMenu.Group>
			<DropdownMenu.Item
				class="cursor-pointer gap-2 text-white hover:bg-white/10 focus:bg-white/10 focus:text-white"
				onclick={onPreview}
			>
				<MxIcon name="security-eye-outline" data-icon="inline-start" />
				Preview
			</DropdownMenu.Item>
			<DropdownMenu.Item
				class="cursor-pointer gap-2 text-white hover:bg-white/10 focus:bg-white/10 focus:text-white"
				onclick={onDownload}
			>
				<MxIcon name="arrows-action-import-outline" data-icon="inline-start" />
				Download
			</DropdownMenu.Item>
			<DropdownMenu.Separator class="bg-white/10" />
			<DropdownMenu.Item
				class="cursor-pointer gap-2 text-red-400 hover:text-white focus:bg-red-400 focus:text-white"
				onclick={onDelete}
			>
				<MxIcon name="trash-bin-minimalistic-outline" data-icon="inline-start" />
				Delete
			</DropdownMenu.Item>
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu.Root>
