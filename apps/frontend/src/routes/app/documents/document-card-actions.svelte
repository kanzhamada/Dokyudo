<script lang="ts">
	import EllipsisVerticalIcon from '@lucide/svelte/icons/ellipsis-vertical';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';

	let { id, onPreview }: { id: string; onPreview?: () => void } = $props();
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="ghost"
				size="icon"
				class="relative size-8 cursor-pointer rounded-full text-white/60 hover:bg-white/10 focus-visible:bg-white/10 focus-visible:text-white data-[state=open]:bg-white/10"
			>
				<span class="sr-only">Open menu</span>
				<EllipsisVerticalIcon />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content
		align="end"
		class="w-40 rounded-xl border-white/10 bg-[#2A2A2A] text-white shadow-xl"
	>
		<DropdownMenu.Group>
			<DropdownMenu.Item
				class="cursor-pointer gap-2 text-white hover:bg-white/10 focus:bg-white/10 focus:text-white"
				onclick={onPreview}
			>
				<EyeIcon data-icon="inline-start" />
				Preview
			</DropdownMenu.Item>
			<DropdownMenu.Item
				class="cursor-pointer gap-2 text-white hover:bg-white/10 focus:bg-white/10 focus:text-white"
			>
				<DownloadIcon data-icon="inline-start" />
				Download
			</DropdownMenu.Item>
			<DropdownMenu.Separator class="bg-white/10" />
			<DropdownMenu.Item
				class="cursor-pointer gap-2 text-red-400 hover:text-white focus:bg-red-400 focus:text-white"
			>
				<Trash2Icon data-icon="inline-start" />
				Delete
			</DropdownMenu.Item>
		</DropdownMenu.Group>
	</DropdownMenu.Content>
</DropdownMenu.Root>
