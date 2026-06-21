<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from '$lib/components/app/AppSidebar.svelte';
	import MobileHeader from '$lib/components/app/MobileHeader.svelte';

	// Background image
	import vintageBg from '$lib/assets/images/vintage_floral_bg.webp';

	let { children } = $props();
</script>

<Sidebar.Provider>
	<AppSidebar />
	<main class="relative flex min-h-svh flex-1 flex-col overflow-hidden ">
		
		<MobileHeader />

		<!-- Main Content Layer -->
		<div class="relative z-10 flex-1">
			<!-- Note: We intentionally do not place the SidebarTrigger here
			     as it is housed within the AppSidebar header per design requirements -->
			{@render children()}
		</div>
	</main>
</Sidebar.Provider>
