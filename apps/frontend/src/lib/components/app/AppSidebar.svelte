<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { scale } from 'svelte/transition';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import * as AvatarPrimitive from '$lib/components/ui/avatar/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';

	// Icons
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import MxIcon from '$lib/components/icons/MxIcon.svelte';
	import { mxBoldName } from '$lib/components/icons/mx-icons-data';
	import type { MxIconName } from '$lib/components/icons/mx-icons-data';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import PanelLeft from '@lucide/svelte/icons/panel-left';
	import Share from '@lucide/svelte/icons/share';
	import Link2 from '@lucide/svelte/icons/link-2';

	// Brand Logo
	import favicon from '$lib/assets/favicon.svg?raw';

	// App Logic
	import { useSidebar } from '$lib/components/ui/sidebar/index.js';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import EditTitleDialog from '$lib/components/app/EditTitleDialog.svelte';
	import ConfirmDeleteDialog from '$lib/components/app/ConfirmDeleteDialog.svelte';
	import { authLogout } from '$lib/api/auth';
	import { getMeCached } from '$lib/state/me-cache.store.svelte';
	import { conversationCache } from '$lib/state/conversation-cache.store.svelte';
	import { getConversations, updateConversation, deleteConversation } from '$lib/api/rag';
	import ShareConversationDialog from '$lib/components/app/ShareConversationDialog.svelte';
	import AccountPanelDialog from '$lib/components/app/AccountPanelDialog.svelte';
	import { openAccountPanel } from '$lib/state/account-panel.store.svelte';
	import { sessionStore } from '$lib/state/session.store.svelte';
	import { conversationsStore } from '$lib/state/conversations.store.svelte';
	import type { UserProfileResponse } from '$lib/types/auth.types';
	import type { ConversationItem } from '$lib/types/rag.types';

	let userProfile = $state<UserProfileResponse | null>(null);
	let isLogoutDialogOpen = $state(false);
	let isLoggingOut = $state(false);

	let conversations = $state<ConversationItem[]>([]);
	let nextCursor = $state<string | null>(null);
	let isLoadingConversations = $state(false);
	let hasLoadedInitialConversations = $state(false);

	let isEditDialogOpen = $state(false);
	let editingConversation = $state<ConversationItem | null>(null);
	let editTitle = $state('');
	let isUpdating = $state(false);

	let isDeleteDialogOpen = $state(false);
	let deletingConversation = $state<ConversationItem | null>(null);
	let isDeleting = $state(false);

	let isUserMenuOpen = $state(false);
	let activeConversationMenu = $state<{ item: ConversationItem; x: number; y: number } | null>(
		null
	);

	function openConversationMenu(e: MouseEvent, item: ConversationItem) {
		e.preventDefault();
		e.stopPropagation();
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		activeConversationMenu = {
			item,
			x: rect.left,
			y: rect.top + rect.height
		};
	}

	function sortConversations(list: ConversationItem[]): ConversationItem[] {
		return [...list].sort((a, b) => {
			if (a.isPinned !== b.isPinned) {
				return b.isPinned ? 1 : -1;
			}
			return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
		});
	}

	async function fetchConversations(cursor?: string) {
		if (isLoadingConversations) return;
		isLoadingConversations = true;

		try {
			const result = await getConversations({ limit: 50, cursor });
			if (result.ok) {
				if (cursor) {
					// Cursor pagination can return items already in the list: the backend
					// orders by isPinned + updatedAt but filters by updatedAt only, so
					// pinned items straddle page boundaries; concurrent updates bump
					// updatedAt mid-scroll too. Dedupe by id before merging — a duplicate
					// key would crash the keyed each block (each_key_duplicate).
					const seenIds = new Set(conversations.map((c) => c.id));
					const freshItems = result.data.conversations.filter((c) => !seenIds.has(c.id));
					conversations = sortConversations([...conversations, ...freshItems]);
				} else {
					conversations = sortConversations(result.data.conversations);
				}
				conversationsStore.set(conversations);
				nextCursor = result.data.nextCursor;
				console.log('[Auth Conversations] Loaded conversations:', {
					count: result.data.conversations.length,
					nextCursor: result.data.nextCursor
				});
			} else {
				console.error('[Auth Conversations] Failed to fetch conversations:', result.error);
			}
		} catch (err) {
			console.error('[Auth Conversations] Catch Error:', err);
		} finally {
			isLoadingConversations = false;
			hasLoadedInitialConversations = true;
		}
	}

	function handleSidebarScroll(event: Event) {
		const target = event.currentTarget as HTMLElement;
		if (!target || isLoadingConversations || !nextCursor) return;

		const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
		if (distanceToBottom < 50) {
			console.log('[Auth Conversations] Infinite scroll fetching cursor:', nextCursor);
			fetchConversations(nextCursor);
		}
	}

	let scrollContainer: HTMLElement | null = null;
	let sentinelEl: HTMLDivElement | null = null;
	let observer: IntersectionObserver | null = null;

	$effect(() => {
		const container = scrollContainer;
		const sentinel = sentinelEl;
		if (!container || !sentinel || !nextCursor) {
			observer?.disconnect();
			observer = null;
			return;
		}

		observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting && nextCursor && !isLoadingConversations) {
					console.log('[Auth Conversations] Sentinel visible, fetching cursor:', nextCursor);
					fetchConversations(nextCursor);
				}
			},
			{ root: container, rootMargin: '100px' }
		);

		observer.observe(sentinel);

		return () => {
			observer?.disconnect();
			observer = null;
		};
	});

	function openEditModal(item: ConversationItem) {
		editingConversation = item;
		editTitle = item.title;
		isEditDialogOpen = true;
	}

	async function handleUpdateConversation(newTitle: string) {
		const targetTitle = newTitle.trim();
		if (!editingConversation || !targetTitle || isUpdating) return;
		isUpdating = true;

		const targetId = editingConversation.id;
		const oldTitle = editingConversation.title;

		console.log('[Auth Conversations] Updating conversation:', {
			id: targetId,
			title: targetTitle
		});

		// Optimistically update local list & store for instant real-time feel
		conversations = sortConversations(
			conversations.map((c) => (c.id === targetId ? { ...c, title: targetTitle } : c))
		);
		conversationsStore.addOrUpdate(targetId, targetTitle);
		isEditDialogOpen = false;

		try {
			const result = await updateConversation(targetId, {
				title: targetTitle
			});

			if (result.ok) {
				console.log('[Auth Conversations] Update success:', result.data);
				toast.success('Conversation title updated');
				editingConversation = null;
			} else {
				console.error('[Auth Conversations] Update failed, reverting:', result.error);
				conversations = sortConversations(
					conversations.map((c) => (c.id === targetId ? { ...c, title: oldTitle } : c))
				);
				conversationsStore.addOrUpdate(targetId, oldTitle);
				toast.error(result.error.message);
			}
		} catch (err) {
			console.error('[Auth Conversations] Update Catch Error, reverting:', err);
			conversations = sortConversations(
				conversations.map((c) => (c.id === targetId ? { ...c, title: oldTitle } : c))
			);
			conversationsStore.addOrUpdate(targetId, oldTitle);
			toast.error('Failed to update conversation title');
		} finally {
			isUpdating = false;
		}
	}

	async function handleTogglePin(item: ConversationItem) {
		const newPinnedState = !item.isPinned;

		console.log('[Auth Conversations] Toggling pin:', {
			id: item.id,
			isPinned: newPinnedState
		});

		// Instantly blur active element to prevent lingering focus-within styles on dropdown trigger button
		if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}

		// Realtime illusion: Optimistically update local state & store without altering updatedAt
		conversations = sortConversations(
			conversations.map((c) => (c.id === item.id ? { ...c, isPinned: newPinnedState } : c))
		);
		conversationsStore.togglePin(item.id, newPinnedState);

		try {
			const result = await updateConversation(item.id, { isPinned: newPinnedState });
			if (result.ok) {
				console.log('[Auth Conversations] Pin toggle backend response:', result.data);
				toast.success(newPinnedState ? 'Conversation pinned' : 'Conversation unpinned');
			} else {
				console.error('[Auth Conversations] Pin toggle failed, reverting:', result.error);
				conversations = sortConversations(
					conversations.map((c) => (c.id === item.id ? { ...c, isPinned: item.isPinned } : c))
				);
				conversationsStore.togglePin(item.id, item.isPinned);
				toast.error(result.error.message);
			}
		} catch (err) {
			console.error('[Auth Conversations] Pin toggle catch error, reverting:', err);
			conversations = sortConversations(
				conversations.map((c) => (c.id === item.id ? { ...c, isPinned: item.isPinned } : c))
			);
			conversationsStore.togglePin(item.id, item.isPinned);
			toast.error('Failed to update pin status');
		}
	}

	function openDeleteModal(item: ConversationItem) {
		deletingConversation = item;
		isDeleteDialogOpen = true;
	}

	let isShareDialogOpen = $state(false);
	let sharingConversation = $state<ConversationItem | null>(null);

	function openShareDialog(item: ConversationItem) {
		sharingConversation = item;
		isShareDialogOpen = true;
	}

	async function handleDeleteConversation() {
		if (!deletingConversation || isDeleting) return;
		isDeleting = true;

		const deletedId = deletingConversation.id;
		console.log('[Auth Conversations] Deleting conversation:', deletedId);

		// Realtime illusion: Optimistically remove from local state AND conversationsStore immediately
		conversations = conversations.filter((c) => c.id !== deletedId);
		conversationsStore.remove(deletedId);
		isDeleteDialogOpen = false;

		try {
			const result = await deleteConversation(deletedId);

			if (result.ok) {
				console.log('[Auth Conversations] Delete success:', result.data);
				toast.success('Conversation deleted');
				if ($page.url.pathname === `/app/chat/${deletedId}`) {
					await goto('/app/chat');
				}
				deletingConversation = null;
			} else {
				console.error('[Auth Conversations] Delete failed, reverting:', result.error);
				toast.error(result.error.message);
				await fetchConversations();
			}
		} catch (err) {
			console.error('[Auth Conversations] Delete Catch Error, reverting:', err);
			toast.error('Failed to delete conversation');
			await fetchConversations();
		} finally {
			isDeleting = false;
		}
	}

	onMount(async () => {
		if ($page.url.searchParams.get('billing') === 'open') {
			openAccountPanel('billing');
		}

		try {
			const result = await getMeCached();
			if (result.ok) {
				userProfile = result.data;
				console.log('[Auth Me] User details loaded:', result.data);
			} else {
				console.error('[Auth Me] Failed to fetch user profile:', result.error);
			}
		} catch (err) {
			console.error('[Auth Me] Catch Error:', err);
		}

		fetchConversations();
	});

	let displayName = $derived(
		userProfile?.tenant?.name ||
			(userProfile?.user?.email ? userProfile.user.email.split('@')[0] : 'User')
	);

	let userInitials = $derived.by(() => {
		if (!displayName) return 'KH';
		const parts = displayName.trim().split(' ');
		if (parts.length >= 2) {
			return (parts[0][0] + parts[1][0]).toUpperCase();
		}
		return displayName.slice(0, 2).toUpperCase();
	});

	let subscriptionTier = $derived.by(() => {
		const raw = userProfile?.subscription?.tier || 'FREE';
		const cleaned = raw.replace(/_/g, ' ').toLowerCase();
		return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
	});

	async function handleLogout() {
		if (isLoggingOut) return;
		isLoggingOut = true;

		console.log('[Auth Logout] Initiating sign out...');
		try {
			const result = await authLogout();
			console.log('[Auth Logout] Backend Response:', result);
		} catch (err) {
			console.error('[Auth Logout] Catch Error:', err);
		} finally {
			sessionStore.clear();
			console.log('[Auth Logout] Session cleared. Redirecting to /login');
			isLoggingOut = false;
			isLogoutDialogOpen = false;
			await goto('/login');
		}
	}

	const navItems: {
		label: string;
		icon: MxIconName | typeof LayoutGrid;
		active: boolean;
		href: string;
	}[] = $derived([
		{
			label: 'Dashboard',
			icon: LayoutGrid,
			active: $page.url.pathname.startsWith('/app/dashboard'),
			href: '/app/dashboard'
		},
		{
			label: 'Document Library',
			icon: 'document-outline',
			active: $page.url.pathname.startsWith('/app/documents'),
			href: '/app/documents'
		},
		{
			label: 'Chat Assistant',
			icon: 'chat-round-line-linear',
			active: $page.url.pathname === '/app/chat' || $page.url.pathname === '/app/chat/',
			href: '/app/chat'
		},
		{
			label: 'Activity Feed',
			icon: 'clock-outline',
			active: $page.url.pathname.startsWith('/app/activity'),
			href: '/app/activity'
		}
	]);

	const conversationSkeletons = [0, 1, 2, 3];

	const sidebar = useSidebar();

	/** Hovered nav href — drives the outline -> bold icon swap on hover. */
	let hoveredNavHref = $state<string | null>(null);
</script>

<Sidebar.Root collapsible="icon" class="border-none">
	<!-- HEADER -->
	<Sidebar.Header class="group-data-[collapsible=icon]:hidden">
		<div class="group/header flex items-center justify-between px-2.5 md:px-1.5 py-2.5 md:py-2">
			<div class="flex items-center gap-1.5">
				<!-- Brand Logo -->
				<div
					class="flex size-7 items-center justify-center [&_path]:fill-sidebar-brand [&_svg]:h-8 [&_svg]:w-auto"
				>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html favicon}
				</div>
				<!-- Brand Text (Hidden when collapsed) -->
				<span
					class="font-sans text-[18px] font-medium tracking-tight text-sidebar-brand group-data-[collapsible=icon]:hidden"
				>
					okyudo
				</span>
			</div>
			<!-- Internal Trigger (Hidden when collapsed, revealed on hover) -->
			<div
				class="transition-opacity group-hover/header:pointer-events-auto group-hover/header:opacity-100 group-data-[collapsible=icon]:hidden"
			>
				<Sidebar.Trigger
					class="size-6 md:size-5 shrink-0 cursor-pointer text-sidebar-foreground/70 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:scale-90 active:bg-sidebar-accent active:text-white"
				/>
			</div>
		</div>
	</Sidebar.Header>

	<div class="flex min-h-0 flex-1 flex-col">
		<!-- CONTENT -->
		<Sidebar.Content class="gap-0 overflow-hidden">
			<!-- Main Navigation -->
			<Sidebar.Group class="shrink-0 px-2.5 md:px-2 pt-2.5 md:pt-2 pb-1.5 md:pb-1">
				<Sidebar.Menu class="gap-1.5 md:gap-1">
					<!-- Collapsed mode logo injected directly into the menu structure -->
					<Sidebar.MenuItem class="hidden group-data-[collapsible=icon]:block">
						<Sidebar.MenuButton
							class="h-10 md:h-9 px-3 md:px-2 font-geist text-[14px] md:text-[13px] transition-all duration-150 active:scale-[0.98] active:bg-sidebar-accent"
							tooltipContent="Expand Sidebar (Ctrl + B)"
						>
							{#snippet child({ props })}
								<a
									href="##"
									{...props}
									class={(props.class as string) + ' group/logo cursor-pointer active:scale-[0.98]'}
									onclick={(e) => {
										e.preventDefault();
										sidebar.toggle();
									}}
								>
									<div class="flex size-[18px] items-center justify-center">
										<!-- Logo (Hidden on hover) -->
										<div
											class="flex items-center justify-center group-hover/logo:hidden [&_path]:fill-sidebar-brand [&_svg]:h-4 [&_svg]:w-auto"
										>
											<!-- eslint-disable-next-line svelte/no-at-html-tags -->
											{@html favicon}
										</div>
										<!-- Expand Icon (Visible on hover) -->
										<PanelLeft class="hidden size-[18px] group-hover/logo:block" />
									</div>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>

					{#each navItems as item (item.href)}
						{@render navItem(item)}
					{/each}
				</Sidebar.Menu>
			</Sidebar.Group>

			<!-- Recent Chats -->
			<!-- Hide entire group when collapsed -->
			<Sidebar.Group
				class="min-h-0 flex-1 overflow-hidden px-2.5 md:px-2 pt-2 md:pt-2 pb-1.5 md:pb-1 group-data-[collapsible=icon]:hidden"
			>
				<Sidebar.GroupLabel
					class="mb-2 md:mb-1 mt-1 md:mt-0 h-6 shrink-0 px-2.5 md:px-2 font-geist text-[11px] md:text-[10px] font-medium tracking-[0.08em] text-sidebar-muted"
				>
					Recent Chats
				</Sidebar.GroupLabel>

				<div
					class="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5"
					onscroll={handleSidebarScroll}
					bind:this={scrollContainer}
				>
					<Sidebar.Menu class="gap-1.5 md:gap-px">
						{#if !hasLoadedInitialConversations && isLoadingConversations}
							{#each conversationSkeletons as skeleton (skeleton)}
								<Sidebar.MenuItem class="px-2 py-1">
									<Skeleton class="h-6 md:h-5 w-full rounded bg-white/5" />
								</Sidebar.MenuItem>
							{/each}
						{:else if (conversationsStore.list.length > 0 ? conversationsStore.list : conversations).length === 0}
							<div class="px-2.5 py-2 md:px-2 md:py-1.5 font-geist text-[12px] md:text-[11px] text-sidebar-muted-foreground/60">
								No recent chats
							</div>
						{:else}
							{#each conversationsStore.list.length > 0 ? conversationsStore.list : conversations as item (item.id)}
								{@render recentChatItem(item)}
							{/each}

							{#if nextCursor}
								<div bind:this={sentinelEl} class="h-px w-full"></div>
							{/if}

							{#if isLoadingConversations}
								<div class="flex items-center justify-center py-1.5">
									<Spinner class="size-3.5 text-white/50" />
								</div>
							{/if}
						{/if}
					</Sidebar.Menu>
				</div>
			</Sidebar.Group>
		</Sidebar.Content>
	</div>

	<!-- FOOTER -->
	<Sidebar.Footer class="pb-3 px-2.5 md:px-2">
		<div class="mx-2 mb-2 md:mb-1.5 h-px bg-white/10"></div>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton
					size="lg"
					tooltipContent="Profile"
					class="h-14! md:h-12! w-full cursor-pointer p-2 md:p-1.5 transition-all duration-150 hover:bg-sidebar-accent active:scale-[0.98] active:bg-sidebar-accent active:brightness-110"
					onclick={() => (isUserMenuOpen = !isUserMenuOpen)}
				>
					<AvatarPrimitive.Root
						class="size-8 md:size-7 shrink-0 overflow-hidden rounded-full border-none bg-sidebar-avatar"
					>
						{#if userProfile?.user?.profilePictureUrl}
							<AvatarPrimitive.Image
								src={userProfile.user.profilePictureUrl}
								alt={displayName}
								class="size-full object-cover"
							/>
						{/if}
						<AvatarPrimitive.Fallback
							class="flex size-full items-center justify-center rounded-md bg-sidebar-avatar font-geist text-xs font-medium text-sidebar"
						>
							{userInitials}
						</AvatarPrimitive.Fallback>
					</AvatarPrimitive.Root>
					<div
						class="ml-2 md:ml-1.5 flex flex-1 flex-col items-start justify-center gap-0.5 overflow-hidden group-data-[collapsible=icon]:hidden"
					>
						<span class="truncate font-geist text-[14px] md:text-[13px] font-medium text-white">{displayName}</span
						>
						<span class="truncate font-geist text-[12px] md:text-[11px] text-sidebar-muted-foreground"
							>{subscriptionTier}</span
						>
					</div>
					<ChevronsUpDown
						class="size-4 md:size-3.5 shrink-0 text-white opacity-50 group-data-[collapsible=icon]:hidden"
					/>
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>

	<!-- Exact edge trigger for opening the collapsed sidebar. -->
	<Sidebar.Rail class="after:hidden" />
</Sidebar.Root>

{#snippet navItem(item: (typeof navItems)[0])}
	<Sidebar.MenuItem>
		<Sidebar.MenuButton
			isActive={item.active}
			tooltipContent={item.label}
			class="h-10 md:h-9 px-3 md:px-2 font-geist text-[14px] md:text-[13px] transition-all duration-150 active:scale-[0.98] active:bg-sidebar-accent active:text-white"
		>
			{#snippet child({ props })}
				<a
					href={item.href}
					{...props}
					class={(props.class as string) + ' transition-all duration-150 active:scale-[0.98] active:bg-sidebar-accent'}
					onclick={() => {
						if (sidebar.isMobile) sidebar.setOpenMobile(false);
					}}
					onmouseenter={() => (hoveredNavHref = item.href)}
					onmouseleave={() => (hoveredNavHref = null)}
				>
					{#if typeof item.icon === 'string'}
						{#if mxBoldName(item.icon) && (item.active || hoveredNavHref === item.href)}
							<MxIcon
								name={mxBoldName(item.icon)!}
								class="mr-3 md:mr-2.5 size-4.5 md:size-4 group-data-[collapsible=icon]:mr-0"
							/>
						{:else}
							<MxIcon name={item.icon} class="mr-3 md:mr-2.5 size-4.5 md:size-4 group-data-[collapsible=icon]:mr-0" />
						{/if}
					{:else}
						<item.icon class="mr-3 md:mr-2.5 size-4.5 md:size-4 group-data-[collapsible=icon]:mr-0" />
					{/if}
					<span class="group-data-[collapsible=icon]:hidden">{item.label}</span>
				</a>
			{/snippet}
		</Sidebar.MenuButton>
	</Sidebar.MenuItem>
{/snippet}

{#snippet recentChatItem(item: ConversationItem)}
	<Sidebar.MenuItem>
		<Sidebar.MenuButton
			isActive={$page.url.pathname === `/app/chat/${item.id}`}
			class="h-9.5 md:h-7 cursor-pointer px-3 md:px-2 font-geist text-[13.5px] md:text-xs text-sidebar-muted-foreground transition-all duration-150 active:scale-[0.98] active:bg-sidebar-accent active:text-white"
		>
			{#snippet child({ props })}
				<a
					href="/app/chat/{item.id}"
					{...props}
					class={(props.class as string) + ' w-full overflow-hidden text-left transition-all duration-150 active:scale-[0.98] active:bg-sidebar-accent'}
					onclick={() => {
						if (sidebar.isMobile) sidebar.setOpenMobile(false);
					}}
					onmouseenter={() => conversationCache.prefetch(item.id)}
				>
					{#if item.title.length > 25}
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props: tooltipProps })}
									<span {...tooltipProps} class="block w-full truncate text-left">{item.title}</span
									>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content side="right" class="max-w-xs break-words text-black">
								<p>{item.title}</p>
							</Tooltip.Content>
						</Tooltip.Root>
					{:else}
						<span class="block w-full truncate">{item.title}</span>
					{/if}
				</a>
			{/snippet}
		</Sidebar.MenuButton>

		<!-- Action Menu & Indicators (pin only — sharing is managed from the profile menu) -->
		{#if item.isPinned}
			<Sidebar.MenuAction
				showOnHover={false}
				class="top-2 md:top-1 cursor-pointer transition-all duration-150 active:scale-90 active:bg-sidebar-accent/80 size-6 md:size-5 flex items-center justify-center"
				onclick={(e) => openConversationMenu(e, item)}
			>
				<div
					class="flex size-full items-center justify-center gap-1 group-hover/menu-item:hidden"
					class:hidden={activeConversationMenu?.item.id === item.id}
				>
					<MxIcon name="pin-bold" class="size-3.5 rotate-45 text-sidebar-muted-foreground/70" />
				</div>
				<div
					class="hidden size-full items-center justify-center group-hover/menu-item:flex"
					class:flex={activeConversationMenu?.item.id === item.id}
				>
					<MxIcon name="menu-dots-outline" class="size-4" />
				</div>
			</Sidebar.MenuAction>
		{:else}
			<Sidebar.MenuAction
				showOnHover={true}
				class="top-2 md:top-1 cursor-pointer transition-all duration-150 active:scale-90 active:bg-sidebar-accent/80 size-6 md:size-5 flex items-center justify-center"
				onclick={(e) => openConversationMenu(e, item)}
			>
				<MxIcon name="menu-dots-outline" class="size-4" />
			</Sidebar.MenuAction>
		{/if}
	</Sidebar.MenuItem>
{/snippet}

<!-- Floating User Account Menu -->
{#if isUserMenuOpen}
	<!-- Backdrop to capture click outside -->
	<div
		role="presentation"
		class="fixed inset-0 z-[60] bg-transparent"
		onclick={() => (isUserMenuOpen = false)}
		onkeydown={() => (isUserMenuOpen = false)}
	></div>

	<!-- Positioned Floating User Account Menu -->
	<div
		transition:scale={{ duration: 150, start: 0.95 }}
		class="fixed bottom-16 left-3 z-[60] w-56 min-w-56 rounded-xl border border-white/15 bg-[#232323]/95 p-1 text-white shadow-2xl backdrop-blur-2xl"
	>
		<div class="px-2.5 py-1.5 font-sans text-xs font-semibold text-white/45">My Account</div>
		<div class="my-1 h-px bg-white/10"></div>
		<button
			type="button"
			class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-[0.98] active:bg-white/15 active:text-white"
			onclick={() => {
				isUserMenuOpen = false;
				if (sidebar.isMobile) sidebar.setOpenMobile(false);
				openAccountPanel('settings');
			}}
		>
			<MxIcon name="settings-settings-outline" class="size-3.5 text-white/60" />
			<span>Settings</span>
		</button>
		<button
			type="button"
			class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-[0.98] active:bg-white/15 active:text-white"
			onclick={() => {
				isUserMenuOpen = false;
				if (sidebar.isMobile) sidebar.setOpenMobile(false);
				openAccountPanel('billing');
			}}
		>
			<MxIcon name="card-linear" class="size-3.5 text-white/60" />
			<span>Billing</span>
		</button>
		<button
			type="button"
			class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-[0.98] active:bg-white/15 active:text-white"
			onclick={() => {
				isUserMenuOpen = false;
				if (sidebar.isMobile) sidebar.setOpenMobile(false);
				openAccountPanel('shared-links');
			}}
		>
			<Link2 class="size-3.5 text-white/60" />
			<span>Shared links</span>
		</button>
		<div class="my-1 h-px bg-white/10"></div>
		<button
			type="button"
			class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-red-400 transition-all duration-150 hover:bg-red-500/10 hover:text-red-300 focus:bg-red-500/10 focus:text-red-300 focus:outline-none active:scale-[0.98] active:bg-red-500/20 active:text-red-200"
			onclick={() => {
				isUserMenuOpen = false;
				if (sidebar.isMobile) sidebar.setOpenMobile(false);
				isLogoutDialogOpen = true;
			}}
		>
			<MxIcon name="logout3-bold" class="size-3.5 shrink-0 text-red-400" />
			<span>Log out</span>
		</button>
	</div>
{/if}

<!-- Floating Conversation Action Menu -->
{#if activeConversationMenu}
	<!-- Backdrop to capture click outside -->
	<div
		role="presentation"
		class="fixed inset-0 z-[60] bg-transparent"
		onclick={() => (activeConversationMenu = null)}
		onkeydown={() => (activeConversationMenu = null)}
	></div>

	<!-- Positioned Floating Menu -->
	<div
		transition:scale={{ duration: 150, start: 0.95 }}
		style={`position: fixed; top: ${Math.min(activeConversationMenu.y + 4, window.innerHeight - 170)}px; left: ${Math.min(Math.max(16, activeConversationMenu.x - 140), window.innerWidth - 200)}px;`}
		class="z-[60] w-48 rounded-xl border border-white/15 bg-[#232323]/95 p-1 text-white shadow-2xl backdrop-blur-2xl"
	>
		<button
			type="button"
			class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-[0.98] active:bg-white/15 active:text-white"
			onclick={() => {
				const item = activeConversationMenu?.item;
				activeConversationMenu = null;
				if (sidebar.isMobile) sidebar.setOpenMobile(false);
				if (item) openShareDialog(item);
			}}
		>
			<Share class="size-3.5 text-white/60" />
			<span>Share</span>
		</button>
		<button
			type="button"
			class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-[0.98] active:bg-white/15 active:text-white"
			onclick={() => {
				const item = activeConversationMenu?.item;
				activeConversationMenu = null;
				if (sidebar.isMobile) sidebar.setOpenMobile(false);
				if (item) openEditModal(item);
			}}
		>
			<MxIcon name="edit2-outline" class="size-3.5 text-white/60" />
			<span>Edit</span>
		</button>
		<button
			type="button"
			class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-[0.98] active:bg-white/15 active:text-white"
			onclick={() => {
				const item = activeConversationMenu?.item;
				activeConversationMenu = null;
				if (item) handleTogglePin(item);
			}}
		>
			{#if activeConversationMenu.item.isPinned}
				<MxIcon name="pin-bold" class="size-3.5 text-white/60" />
				<span>Unpin</span>
			{:else}
				<MxIcon name="pin-outline" class="size-3.5 text-white/60" />
				<span>Pin</span>
			{/if}
		</button>
		<div class="my-1 h-px bg-white/10"></div>
		<button
			type="button"
			class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-red-400 transition-all duration-150 hover:bg-red-500/10 hover:text-red-300 focus:bg-red-500/10 focus:text-red-300 focus:outline-none active:scale-[0.98] active:bg-red-500/20 active:text-red-200"
			onclick={() => {
				const item = activeConversationMenu?.item;
				activeConversationMenu = null;
				if (sidebar.isMobile) sidebar.setOpenMobile(false);
				if (item) openDeleteModal(item);
			}}
		>
			<MxIcon name="trash-bin-minimalistic-outline" class="size-3.5 shrink-0 text-red-400" />
			<span>Delete</span>
		</button>
	</div>
{/if}

<!-- Confirmation Dialog for Logout -->
<Dialog.Root bind:open={isLogoutDialogOpen}>
	<Dialog.Content
		class="border-white/10 bg-[#232323]/[0.85] text-white backdrop-blur-[42px] sm:max-w-md"
	>
		<Dialog.Header>
			<Dialog.Title class="text-lg font-semibold text-white">Log out</Dialog.Title>
			<Dialog.Description class="text-sm text-white/45">
				Are you sure you want to log out? You will need to sign in again to access your Dokyudo
				workspace.
			</Dialog.Description>
		</Dialog.Header>

		<Dialog.Footer class="mt-1 flex gap-2 sm:justify-end">
			<Button
				variant="ghost"
				disabled={isLoggingOut}
				onclick={() => (isLogoutDialogOpen = false)}
				class="cursor-pointer text-white/60 hover:bg-white/10 hover:text-white"
			>
				Cancel
			</Button>
			<Button
				disabled={isLoggingOut}
				onclick={handleLogout}
				class="cursor-pointer bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
			>
				{#if isLoggingOut}
					<Spinner class="mr-2 size-4" />
					Logging out...
				{:else}
					Log out
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Edit Conversation Modal -->
<EditTitleDialog
	bind:open={isEditDialogOpen}
	title={editTitle}
	isSaving={isUpdating}
	onSave={handleUpdateConversation}
	onClose={() => {
		isEditDialogOpen = false;
		editingConversation = null;
	}}
/>

<!-- Delete Confirmation Dialog -->
<ConfirmDeleteDialog
	bind:open={isDeleteDialogOpen}
	title="Delete"
	itemName={deletingConversation?.title}
	description="This will permanently delete this conversation and its history."
	confirmLabel="Delete conversation"
	{isDeleting}
	onConfirm={handleDeleteConversation}
	onClose={() => {
		isDeleteDialogOpen = false;
		deletingConversation = null;
	}}
/>

<!-- Share Conversation Dialog -->
{#if sharingConversation}
	<ShareConversationDialog
		bind:open={isShareDialogOpen}
		conversationId={sharingConversation.id}
		conversationTitle={sharingConversation.title}
		onClose={() => {
			isShareDialogOpen = false;
			sharingConversation = null;
		}}
	/>
{/if}

<AccountPanelDialog
	onNameUpdated={(name) => {
		if (userProfile) {
			userProfile = { ...userProfile, tenant: { ...userProfile.tenant, name } };
		}
	}}
/>

<style>
	:global([data-slot="sidebar"] button),
	:global([data-slot="sidebar"] a),
	:global([data-slot="sidebar"] [data-slot="sidebar-menu-button"]),
	:global([data-slot="sidebar"] [data-slot="sidebar-menu-action"]) {
		-webkit-tap-highlight-color: rgba(255, 255, 255, 0.08);
		touch-action: manipulation;
	}
</style>
