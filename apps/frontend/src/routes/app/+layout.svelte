<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from '$lib/components/app/AppSidebar.svelte';
	import MobileHeader from '$lib/components/app/MobileHeader.svelte';
	import { page } from '$app/state';
	import { onNavigate } from '$app/navigation';

	let { children } = $props();

	// SvelteKit View Transitions — scoped strictly to the "new chat submit"
	// navigation (/app/chat → /app/chat/<id> via goto, i.e. type === 'goto').
	// Only the main content area (below the sidebar) cross-fades as one flat
	// unit, via the `app-main` view-transition-name on <main>; the sidebar and
	// app chrome stay static. The input capsule is intentionally part of that
	// capture (no nested view-transition-name) to avoid sharp corner artifacts.
	// CSS lives in src/routes/layout.css.
	onNavigate((navigation) => {
		const from = navigation.from?.url.pathname ?? '';
		const to = navigation.to?.url.pathname ?? '';
		const isChatSubmit =
			navigation.type === 'goto' && from === '/app/chat' && to.startsWith('/app/chat/');
		if (!isChatSubmit) return;
		if (typeof document === 'undefined' || !('startViewTransition' in document)) return;

		return new Promise<void>((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete?.catch(() => {});
			});
		});
	});
</script>

<Sidebar.Provider>
	<AppSidebar />
	<main
		style="view-transition-name: app-main;"
		class="relative flex h-svh max-h-svh w-full min-w-0 flex-1 flex-col overflow-hidden bg-[#1F1E1D]"
	>
		
		<!-- Decorative Background Circle -->
		<div 
			class="absolute rounded-full pointer-events-none z-0 opacity-7"
			style="width: 1190px; height: 1190px; left: -295px; top: -318px; background: linear-gradient(180deg, #ffffff 0%, #4b3117 100%); filter: blur(99px);"
		></div>

		<div class="relative z-10 flex h-full flex-1 flex-col min-h-0 overflow-hidden">
			{#if !page.url.pathname.startsWith('/app/chat/')}
				<MobileHeader />
			{/if}

			<!-- Main Content Layer -->
			<div class="relative z-10 flex h-full flex-1 flex-col min-h-0 overflow-hidden">
				<!-- Note: We intentionally do not place the SidebarTrigger here
				     as it is housed within the AppSidebar header per design requirements -->
				{@render children()}
			</div>
		</div>
	</main>
</Sidebar.Provider>
