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
	import { mobileHeaderState } from '$lib/state/mobile-header.svelte.js';

	let { children } = $props();

	let isViewTransitioning = $state(false);

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

		isViewTransitioning = true;
		return new Promise<void>((resolve) => {
			const transition = document.startViewTransition(async () => {
				resolve();
				await navigation.complete?.catch(() => {});
			});
			transition.finished
				.catch(() => {})
				.finally(() => {
					isViewTransitioning = false;
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

<div class="relative flex h-svh max-h-svh w-full min-w-0 overflow-hidden bg-black text-white">
	<!-- Decorative Background Circle (Full screen cover behind sidebar and main) -->
	<div
		class="pointer-events-none absolute z-0 rounded-full"
		style="width: 1190px; height: 1190px; left: -295px; top: -318px; background: linear-gradient(180deg, var(--color-white) 0%, var(--color-terracotta-deep) 100%); filter: blur(99px); opacity: 0.07;"
	></div>

	<Sidebar.Provider class="relative z-10 size-full min-h-svh bg-transparent">
		<AppSidebar />
		<main
			style={isViewTransitioning ? 'view-transition-name: app-main;' : ''}
			class="relative flex h-full max-h-svh w-full min-w-0 flex-1 flex-col overflow-hidden bg-transparent"
		>
			<div class="relative z-10 flex h-full min-h-0 flex-1 flex-col overflow-hidden">
				{#if !page.url.pathname.startsWith('/app/chat/') && !mobileHeaderState.hidden}
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
</div>

<SessionExpiredDialog />
