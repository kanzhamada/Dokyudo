<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from '$lib/components/app/AppSidebar.svelte';
	import MobileHeader from '$lib/components/app/MobileHeader.svelte';

	let { children } = $props();
</script>

<Sidebar.Provider>
	<AppSidebar />
	<main class="relative flex h-svh max-h-svh w-full min-w-0 flex-1 flex-col overflow-hidden bg-[#1F1E1D]">
		
		<!-- Decorative Background Circle -->
		<div 
			class="absolute rounded-full pointer-events-none z-0 opacity-7"
			style="width: 1190px; height: 1190px; left: -295px; top: -318px; background: linear-gradient(180deg, #ffffff 0%, #4b3117 100%); filter: blur(99px);"
		></div>

		<div class="relative z-10 flex h-full flex-1 flex-col min-h-0 overflow-hidden">
			<MobileHeader />

			<!-- Main Content Layer -->
			<div class="relative z-10 flex h-full flex-1 flex-col min-h-0 overflow-hidden">
				<!-- Note: We intentionally do not place the SidebarTrigger here
				     as it is housed within the AppSidebar header per design requirements -->
				{@render children()}
			</div>
		</div>
	</main>
</Sidebar.Provider>
