<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import AppSidebar from '$lib/components/app/AppSidebar.svelte';
	import MobileHeader from '$lib/components/app/MobileHeader.svelte';
	import SessionExpiredDialog from '$lib/components/app/SessionExpiredDialog.svelte';
	import { page } from '$app/state';
	import { onNavigate } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { sessionStore } from '$lib/state/session.store.svelte';
	import { sessionExpiryStore } from '$lib/state/session-expiry.store.svelte';

	let { children } = $props();

	// SvelteKit View Transitions — scoped strictly to SUBMIT navigations from
	// the landing page:
	// - chat submit: /app/chat → /app/chat/<id> via goto (type === 'goto')
	// - search submit: /app/chat → /app/documents, only when the navigation
	//   state carries a `searchQuery` (sidebar clicks never animate)
	// Only the main content area (below the sidebar) cross-fades as one flat
	// unit, via the `app-main` view-transition-name on <main>; the sidebar and
	// app chrome stay static. The input capsule is intentionally part of that
	// capture (no nested view-transition-name) to avoid sharp corner artifacts.
	// CSS lives in src/routes/layout.css.
	onNavigate((navigation) => {
		const from = navigation.from?.url.pathname ?? '';
		const to = navigation.to?.url.pathname ?? '';
		const isScopedNavigation =
			navigation.type === 'goto' &&
			from === '/app/chat' &&
			(to.startsWith('/app/chat/') ||
				(to === '/app/documents' && navigation.to?.url.searchParams.get('q') !== null));
		if (!isScopedNavigation) return;
		if (typeof document === 'undefined' || !('startViewTransition' in document)) return;

		return new Promise<void>((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete?.catch(() => {});
			});
		});
	});

	// Detect a lost session (expired/revoked) while the user is actively using
	// the app: poll the session endpoint on a timer and re-check whenever the
	// tab regains focus/visibility. A 401 from any API call also triggers it.
	let expiryTimer: ReturnType<typeof setInterval> | null = null;

	async function checkSession() {
		if (!sessionStore.authenticated) return;
		const stillAuthed = await sessionStore.hydrate();
		if (!stillAuthed) {
			sessionExpiryStore.trigger();
		}
	}

	onMount(() => {
		checkSession();
		expiryTimer = setInterval(checkSession, 30000);
		document.addEventListener('visibilitychange', checkSession);
		window.addEventListener('focus', checkSession);
	});

	onDestroy(() => {
		if (expiryTimer) clearInterval(expiryTimer);
		if (typeof document !== 'undefined') {
			document.removeEventListener('visibilitychange', checkSession);
		}
		if (typeof window !== 'undefined') {
			window.removeEventListener('focus', checkSession);
		}
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
			class="pointer-events-none absolute z-0 rounded-full opacity-7"
			style="width: 1190px; height: 1190px; left: -295px; top: -318px; background: linear-gradient(180deg, #ffffff 0%, #4b3117 100%); filter: blur(99px);"
		></div>

		<div class="relative z-10 flex h-full min-h-0 flex-1 flex-col overflow-hidden">
			{#if !page.url.pathname.startsWith('/app/chat/')}
				<MobileHeader />
			{/if}

			<!-- Main Content Layer -->
			<div class="relative z-10 flex h-full min-h-0 flex-1 flex-col overflow-hidden">
				<!-- Note: We intentionally do not place the SidebarTrigger here
				     as it is housed within the AppSidebar header per design requirements -->
				{@render children()}
			</div>
		</div>
	</main>
</Sidebar.Provider>

<SessionExpiredDialog />
