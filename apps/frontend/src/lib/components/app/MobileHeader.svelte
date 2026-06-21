<script lang="ts">
	import { useSidebar } from '$lib/components/ui/sidebar/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import Menu from '@lucide/svelte/icons/menu';
	import favicon from '$lib/assets/favicon.svg?raw';

	const sidebar = useSidebar();
</script>

<header class="flex h-14 shrink-0 items-center justify-between border-b border-white/5 bg-sidebar px-4 md:hidden">
	<Button
		variant="ghost"
		size="icon"
		class="text-white hover:bg-white/10 hover:text-white"
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
</header>
