<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import { Avatar } from '$lib/components/ui/avatar/index.js';
	import * as AvatarPrimitive from '$lib/components/ui/avatar/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { Input } from '$lib/components/ui/input/index.js';

	// Icons
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import FileText from '@lucide/svelte/icons/file-text';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Clock from '@lucide/svelte/icons/clock';
	import MoreHorizontal from '@lucide/svelte/icons/more-horizontal';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import Share from '@lucide/svelte/icons/share';
	import Edit from '@lucide/svelte/icons/pen';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Pin from '@lucide/svelte/icons/pin';
	import Settings from '@lucide/svelte/icons/settings';
	import CreditCard from '@lucide/svelte/icons/credit-card';
	import LogOut from '@lucide/svelte/icons/log-out';

	// Brand Logo
	import favicon from '$lib/assets/favicon.svg?raw';

	// App Logic
	import PanelLeft from '@lucide/svelte/icons/panel-left';
	import { useSidebar } from '$lib/components/ui/sidebar/index.js';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	import { onMount } from 'svelte';
	import EditTitleDialog from '$lib/components/app/EditTitleDialog.svelte';
	import { authLogout } from '$lib/api/auth';
	import { getMe } from '$lib/api/me';
	import { getConversations, updateConversation, deleteConversation } from '$lib/api/rag';
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
			const result = await getConversations({ limit: 20, cursor });
			if (result.ok) {
				if (cursor) {
					conversations = sortConversations([...conversations, ...result.data.conversations]);
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
				editingConversation = null;
			} else {
				console.error('[Auth Conversations] Update failed, reverting:', result.error);
				conversations = sortConversations(
					conversations.map((c) => (c.id === targetId ? { ...c, title: oldTitle } : c))
				);
				conversationsStore.addOrUpdate(targetId, oldTitle);
			}
		} catch (err) {
			console.error('[Auth Conversations] Update Catch Error, reverting:', err);
			conversations = sortConversations(
				conversations.map((c) => (c.id === targetId ? { ...c, title: oldTitle } : c))
			);
			conversationsStore.addOrUpdate(targetId, oldTitle);
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
			} else {
				console.error('[Auth Conversations] Pin toggle failed, reverting:', result.error);
				conversations = sortConversations(
					conversations.map((c) => (c.id === item.id ? { ...c, isPinned: item.isPinned } : c))
				);
				conversationsStore.togglePin(item.id, item.isPinned);
			}
		} catch (err) {
			console.error('[Auth Conversations] Pin toggle catch error, reverting:', err);
			conversations = sortConversations(
				conversations.map((c) => (c.id === item.id ? { ...c, isPinned: item.isPinned } : c))
			);
			conversationsStore.togglePin(item.id, item.isPinned);
		}
	}

	function openDeleteModal(item: ConversationItem) {
		deletingConversation = item;
		isDeleteDialogOpen = true;
	}

	async function handleDeleteConversation() {
		if (!deletingConversation || isDeleting) return;
		isDeleting = true;

		console.log('[Auth Conversations] Deleting conversation:', deletingConversation.id);

		try {
			const result = await deleteConversation(deletingConversation.id);

			if (result.ok) {
				console.log('[Auth Conversations] Delete success:', result.data);
				const deletedId = deletingConversation.id;
				conversations = conversations.filter((c) => c.id !== deletedId);

				isDeleteDialogOpen = false;

				if ($page.url.pathname === `/app/chat/${deletedId}`) {
					await goto('/app/chat');
				}
				deletingConversation = null;
			} else {
				console.error('[Auth Conversations] Delete failed:', result.error);
			}
		} catch (err) {
			console.error('[Auth Conversations] Delete Catch Error:', err);
		} finally {
			isDeleting = false;
		}
	}

	onMount(async () => {
		try {
			const result = await getMe();
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

	const navItems = $derived([
		{
			label: 'Dashboard',
			icon: LayoutGrid,
			active: $page.url.pathname.startsWith('/app/dashboard'),
			href: '/app/dashboard'
		},
		{
			label: 'Document Library',
			icon: FileText,
			active: $page.url.pathname.startsWith('/app/documents'),
			href: '/app/documents'
		},
		{
			label: 'Chat Assistant',
			icon: MessageSquare,
			active: $page.url.pathname === '/app/chat' || $page.url.pathname === '/app/chat/',
			href: '/app/chat'
		},
		{
			label: 'Activity Feed',
			icon: Clock,
			active: $page.url.pathname.startsWith('/app/activity'),
			href: '/app/activity'
		}
	]);

	const recentChats = [
		'beatae vitae dicta',
		'Lorem ipsum dolor sit amet, c...',
		'But I must explain to you',
		'ptatem accusantium doloremq aksfnaksfakjs kdjnfkjdfn',
		'Lorem Ipsum 123',
		'Lorem Ipsum 123',
		'Lorem Ipsum 123',
		'Lorem Ipsum 123',
		'Lorem Ipsum 123',
		'Lorem Ipsum 123'
	];

	const sidebar = useSidebar();
</script>

<Sidebar.Root collapsible="icon" class="border-none">
	<!-- HEADER -->
	<Sidebar.Header class="group-data-[collapsible=icon]:hidden">
		<div class="group/header flex items-center justify-between px-2 py-3">
			<div class="flex items-center gap-1">
				<!-- Brand Logo -->
				<div
					class="flex size-8 items-center justify-center [&_path]:fill-sidebar-brand [&_svg]:h-9 [&_svg]:w-auto"
				>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html favicon}
				</div>
				<!-- Brand Text (Hidden when collapsed) -->
				<span
					class="font-sans text-xl font-medium tracking-tight text-sidebar-brand group-data-[collapsible=icon]:hidden"
				>
					okyudo
				</span>
			</div>
			<!-- Internal Trigger (Hidden when collapsed, revealed on hover) -->
			<div
				class="transition-opacity group-hover/header:pointer-events-auto group-hover/header:opacity-100 group-data-[collapsible=icon]:hidden"
			>
				<Sidebar.Trigger
					class="size-6 shrink-0 cursor-pointer text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
				/>
			</div>
		</div>
	</Sidebar.Header>

	<div class="no-scrollbar flex-1 overflow-y-auto" onscroll={handleSidebarScroll}>
		<!-- CONTENT -->
		<Sidebar.Content>
			<!-- Main Navigation -->
			<Sidebar.Group class="pt-4">
				<Sidebar.Menu class="gap-2">
					<!-- Collapsed mode logo injected directly into the menu structure -->
					<Sidebar.MenuItem class="hidden group-data-[collapsible=icon]:block">
						<Sidebar.MenuButton
							class="h-10 px-3 font-geist text-[15px]"
							tooltipContent="Expand Sidebar (Ctrl + B)"
						>
							{#snippet child({ props })}
								<a
									href="##"
									{...props}
									class={(props.class as string) + ' group/logo cursor-pointer'}
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

					{#each navItems as item}
						{@render navItem(item)}
					{/each}
				</Sidebar.Menu>
			</Sidebar.Group>

			<!-- Recent Chats -->
			<!-- Hide entire group when collapsed -->
			<Sidebar.Group class="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
				<Sidebar.GroupLabel class="mb-2 px-3 font-geist text-xs font-medium text-sidebar-muted">
					Recent Chats
				</Sidebar.GroupLabel>

				<Sidebar.Menu class="gap-[2px]">
					{#if !hasLoadedInitialConversations && isLoadingConversations}
						{#each Array(4) as _}
							<Sidebar.MenuItem class="px-3 py-1">
								<Skeleton class="h-6 w-full rounded bg-white/5" />
							</Sidebar.MenuItem>
						{/each}
					{:else if (conversationsStore.list.length > 0 ? conversationsStore.list : conversations).length === 0}
						<div class="px-3 py-2 font-geist text-xs text-sidebar-muted-foreground/60">
							No recent chats
						</div>
					{:else}
						{#each (conversationsStore.list.length > 0 ? conversationsStore.list : conversations) as item (item.id)}
							{@render recentChatItem(item)}
						{/each}

						{#if isLoadingConversations}
							<div class="flex items-center justify-center py-2">
								<Spinner class="size-4 text-white/50" />
							</div>
						{/if}
					{/if}
				</Sidebar.Menu>
			</Sidebar.Group>
		</Sidebar.Content>
	</div>

	<!-- FOOTER -->
	<Sidebar.Footer class="pb-4">
		<div class="mx-2 mb-2 h-px bg-white/10"></div>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<!-- Entire footer block acts as the trigger -->
							<Sidebar.MenuButton
								{...props}
								size="lg"
								tooltipContent="Profile"
								class="w-full cursor-pointer p-2 hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent"
							>
								<AvatarPrimitive.Root
									class="size-8 shrink-0 overflow-hidden rounded-full border-none bg-sidebar-avatar"
								>
									{#if userProfile?.user?.profilePictureUrl}
										<AvatarPrimitive.Image
											src={userProfile.user.profilePictureUrl}
											alt={displayName}
											class="size-full object-cover"
										/>
									{/if}
									<AvatarPrimitive.Fallback
										class="flex size-full items-center justify-center rounded-md bg-sidebar-avatar font-geist text-sm font-medium text-sidebar"
									>
										{userInitials}
									</AvatarPrimitive.Fallback>
								</AvatarPrimitive.Root>
								<div
									class="ml-2 flex flex-1 flex-col items-start justify-center gap-0.5 overflow-hidden group-data-[collapsible=icon]:hidden"
								>
									<span class="truncate font-geist text-sm font-medium text-white"
										>{displayName}</span
									>
									<span class="truncate font-geist text-xs text-sidebar-muted-foreground"
										>{subscriptionTier}</span
									>
								</div>
								<ChevronsUpDown
									class="size-4 shrink-0 text-white opacity-50 group-data-[collapsible=icon]:hidden"
								/>
							</Sidebar.MenuButton>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content
						side="top"
						align="center"
						class="mb-2 w-56 min-w-56 rounded-lg border-white/10 bg-sidebar text-sidebar-foreground"
					>
						<DropdownMenu.Label
							class="p-2 font-geist text-xs font-medium text-sidebar-muted-foreground"
							>My Account</DropdownMenu.Label
						>
						<DropdownMenu.Separator class="bg-white/10" />
						<DropdownMenu.Group>
							<DropdownMenu.Item
								class="cursor-pointer text-white hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus:bg-sidebar-accent focus:text-sidebar-accent-foreground"
							>
								<Settings class="mr-2 size-4" />
								<span>Settings</span>
							</DropdownMenu.Item>
							<DropdownMenu.Item
								class="cursor-pointer text-white hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus:bg-sidebar-accent focus:text-sidebar-accent-foreground"
							>
								<CreditCard class="mr-2 size-4" />
								<span>Billing</span>
							</DropdownMenu.Item>
						</DropdownMenu.Group>
						<DropdownMenu.Separator class="bg-white/10" />
						<DropdownMenu.Item
							class="cursor-pointer text-[#FB6363] hover:bg-[#FB6363]/10 hover:text-[#FB6363] focus:bg-[#FB6363]/10 focus:text-[#FB6363]"
							onclick={() => (isLogoutDialogOpen = true)}
						>
							<LogOut class="mr-2 size-4" />
							<span>Log out</span>
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>
</Sidebar.Root>

{#snippet navItem(item: (typeof navItems)[0])}
	<Sidebar.MenuItem>
		<Sidebar.MenuButton
			isActive={item.active}
			tooltipContent={item.label}
			class="h-10 px-3 font-geist text-[15px]"
		>
			{#snippet child({ props })}
				<a href={item.href} {...props}>
					<item.icon class="mr-3 size-[18px] group-data-[collapsible=icon]:mr-0" />
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
			class="h-8 cursor-pointer px-3 font-geist text-sm text-sidebar-muted-foreground"
		>
			{#snippet child({ props })}
				<a
					href="/app/chat/{item.id}"
					{...props}
					class={(props.class as string) + ' w-full overflow-hidden text-left'}
				>
					{#if item.title.length > 25}
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props: tooltipProps })}
									<span {...tooltipProps} class="block w-full truncate text-left">{item.title}</span>
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

		<!-- Action Menu & Pin Indicator -->
		<DropdownMenu.Root>
			<DropdownMenu.Trigger class="cursor-pointer">
				{#snippet child({ props })}
					{#if item.isPinned}
						<Sidebar.MenuAction showOnHover={false} {...props}>
							<div
								class="flex size-full items-center justify-center group-hover/menu-item:hidden data-[state=open]:hidden"
							>
								<Pin class="size-3.5 rotate-45 text-sidebar-muted-foreground/70" />
							</div>
							<div
								class="hidden size-full items-center justify-center group-hover/menu-item:flex data-[state=open]:flex"
							>
								<MoreHorizontal class="size-4" />
							</div>
						</Sidebar.MenuAction>
					{:else}
						<Sidebar.MenuAction showOnHover={true} {...props}>
							<MoreHorizontal class="size-4" />
						</Sidebar.MenuAction>
					{/if}
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content class="w-48 border-white/10 bg-sidebar text-sidebar-foreground">
				<DropdownMenu.Item
					class="cursor-pointer text-white hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus:bg-sidebar-accent focus:text-sidebar-accent-foreground"
				>
					<Share class="mr-2 size-4" />
					<span>Share</span>
				</DropdownMenu.Item>
				<DropdownMenu.Item
					class="cursor-pointer text-white hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus:bg-sidebar-accent focus:text-sidebar-accent-foreground"
					onclick={() => openEditModal(item)}
				>
					<Edit class="mr-2 size-4" />
					<span>Edit</span>
				</DropdownMenu.Item>
				<DropdownMenu.Item
					class="cursor-pointer text-white hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus:bg-sidebar-accent focus:text-sidebar-accent-foreground"
					onclick={() => handleTogglePin(item)}
				>
					<Pin class="mr-2 size-4" />
					<span>{item.isPinned ? 'Unpin' : 'Pin'}</span>
				</DropdownMenu.Item>
				<DropdownMenu.Separator class="bg-white/10" />
				<DropdownMenu.Item
					class="cursor-pointer text-[#FB6363] hover:bg-[#FB6363]/10 hover:text-[#FB6363] focus:bg-[#FB6363]/10 focus:text-[#FB6363]"
					onclick={() => openDeleteModal(item)}
				>
					<Trash2 class="mr-2 size-4" />
					<span>Delete</span>
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</Sidebar.MenuItem>
{/snippet}

<!-- Confirmation Dialog for Logout -->
<Dialog.Root bind:open={isLogoutDialogOpen}>
	<Dialog.Content class="border-white/10 bg-[#232323] text-white sm:max-w-[425px]">
		<Dialog.Header>
			<Dialog.Title class="font-sans text-xl font-medium text-white">Log out</Dialog.Title>
			<Dialog.Description class="text-sm text-white/70">
				Are you sure you want to log out? You will need to sign in again to access your Dokyudo workspace.
			</Dialog.Description>
		</Dialog.Header>

		<Dialog.Footer class="mt-4 flex gap-2 sm:justify-end">
			<Button
				variant="outline"
				disabled={isLoggingOut}
				onclick={() => (isLogoutDialogOpen = false)}
				class="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
			>
				Cancel
			</Button>
			<Button
				disabled={isLoggingOut}
				onclick={handleLogout}
				class="bg-[#FB6363] text-white hover:bg-[#FB6363]/90"
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

<!-- Delete Conversation Confirmation Dialog -->
<Dialog.Root bind:open={isDeleteDialogOpen}>
	<Dialog.Content class="border-white/10 bg-[#232323] text-white sm:max-w-[425px]">
		<Dialog.Header>
			<Dialog.Title class="font-sans text-xl font-medium text-white">Delete Conversation</Dialog.Title>
			<Dialog.Description class="text-sm text-white/70">
				Are you sure you want to delete <span class="font-medium text-white">"{deletingConversation?.title}"</span>? This action cannot be undone.
			</Dialog.Description>
		</Dialog.Header>

		<Dialog.Footer class="mt-4 flex gap-2 sm:justify-end">
			<Button
				variant="outline"
				disabled={isDeleting}
				onclick={() => (isDeleteDialogOpen = false)}
				class="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"
			>
				Cancel
			</Button>
			<Button
				disabled={isDeleting}
				onclick={handleDeleteConversation}
				class="bg-[#FB6363] text-white hover:bg-[#FB6363]/90"
			>
				{#if isDeleting}
					<Spinner class="mr-2 size-4" />
					Deleting...
				{:else}
					Delete
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
