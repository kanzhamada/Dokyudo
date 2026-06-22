<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Avatar } from '$lib/components/ui/avatar/index.js';
	import * as AvatarPrimitive from '$lib/components/ui/avatar/index.js';

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
			active: $page.url.pathname.startsWith('/app/chat'),
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

	<div class="no-scrollbar flex-1 overflow-y-auto">
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
			<Sidebar.Group class=" flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
				<Sidebar.GroupLabel class="mb-2 px-3 font-geist text-xs font-medium text-sidebar-muted">
					Recent Chats
				</Sidebar.GroupLabel>

				<Sidebar.Menu class="gap-[2px] ">
					{#each recentChats as chat}
						{@render recentChatItem(chat)}
					{/each}
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
									class="size-8 shrink-0 rounded-md border-none bg-sidebar-avatar"
								>
									<AvatarPrimitive.Fallback
										class="rounded-md bg-sidebar-avatar font-geist text-sm font-medium text-sidebar"
										>KH</AvatarPrimitive.Fallback
									>
								</AvatarPrimitive.Root>
								<div
									class="ml-2 flex flex-1 flex-col items-start justify-center gap-0.5 overflow-hidden group-data-[collapsible=icon]:hidden"
								>
									<span class="truncate font-geist text-sm font-medium text-white">Kanz Hamada</span
									>
									<span class="truncate font-geist text-xs text-sidebar-muted-foreground">Free</span
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
							class="cursor-pointer text-red-400 hover:bg-red-400 hover:text-red-400 focus:bg-red-400 focus:text-red-400"
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

{#snippet recentChatItem(chat: string)}
	<Sidebar.MenuItem>
		<Sidebar.MenuButton
			class="h-8 cursor-pointer px-3 font-geist text-sm text-sidebar-muted-foreground"
		>
			{#snippet child({ props })}
				<button {...props} class={(props.class as string) + ' w-full overflow-hidden text-left'}>
					{#if chat.length > 25}
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props: tooltipProps })}
									<span {...tooltipProps} class="block w-full truncate text-left">{chat}</span>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content side="right" class="max-w-xs break-words text-black">
								<p>{chat}</p>
							</Tooltip.Content>
						</Tooltip.Root>
					{:else}
						<span class="block w-full truncate">{chat}</span>
					{/if}
				</button>
			{/snippet}
		</Sidebar.MenuButton>

		<!-- Action Menu visible on hover -->
		<DropdownMenu.Root>
			<DropdownMenu.Trigger class="cursor-pointer">
				{#snippet child({ props })}
					<Sidebar.MenuAction showOnHover {...props}>
						<MoreHorizontal />
					</Sidebar.MenuAction>
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
				>
					<Edit class="mr-2 size-4" />
					<span>Edit</span>
				</DropdownMenu.Item>
				<DropdownMenu.Item
					class="cursor-pointer text-white hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus:bg-sidebar-accent focus:text-sidebar-accent-foreground"
				>
					<Pin class="mr-2 size-4" />
					<span>Pin</span>
				</DropdownMenu.Item>
				<DropdownMenu.Separator class="bg-white/10" />
				<DropdownMenu.Item
					class="cursor-pointer text-red-400 hover:bg-red-400 hover:text-red-400 focus:bg-red-400 focus:text-red-400"
				>
					<Trash2 class="mr-2 size-4" />
					<span>Delete</span>
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</Sidebar.MenuItem>
{/snippet}
