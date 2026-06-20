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

	// Brand Logo
	import favicon from '$lib/assets/favicon.svg?raw';

	// App Logic
	import PanelLeft from '@lucide/svelte/icons/panel-left';
	import { useSidebar } from '$lib/components/ui/sidebar/index.js';

	const navItems = [
		{ label: 'Dashboard', icon: LayoutGrid, active: false },
		{ label: 'Document Library', icon: FileText, active: false },
		{ label: 'Chat Assistant', icon: MessageSquare, active: true },
		{ label: 'Activity Feed', icon: Clock, active: false }
	];

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
					class="flex size-8 items-center justify-center [&_path]:fill-[#C5937B] [&_svg]:h-9 [&_svg]:w-auto"
				>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html favicon}
				</div>
				<!-- Brand Text (Hidden when collapsed) -->
				<span
					class="font-sans text-xl font-medium tracking-tight text-[#C5937B] group-data-[collapsible=icon]:hidden"
				>
					okyudo
				</span>
			</div>
			<!-- Internal Trigger (Hidden when collapsed, revealed on hover) -->
			<div
				class="transition-opacity group-hover/header:pointer-events-auto group-hover/header:opacity-100 group-data-[collapsible=icon]:hidden"
			>
				<Sidebar.Trigger
					class="size-6 shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
						<Sidebar.MenuButton class="h-10 px-3 font-geist text-[15px]">
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
											class="flex items-center justify-center [&_path]:fill-[#C5937B] [&_svg]:h-4 [&_svg]:w-auto group-hover/logo:hidden"
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
						<Sidebar.MenuItem>
							<Sidebar.MenuButton isActive={item.active} class="h-10 px-3 font-geist text-[15px]">
								{#snippet child({ props })}
									<a href="##" {...props}>
										<item.icon class="mr-3 size-[18px] group-data-[collapsible=icon]:mr-0" />
										<span class="group-data-[collapsible=icon]:hidden">{item.label}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.Group>

			<!-- Recent Chats -->
			<!-- Hide entire group when collapsed -->
			<Sidebar.Group class=" flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
				<Sidebar.GroupLabel class="mb-2 px-3 font-geist text-xs font-medium text-[#676767]">
					Recent Chats
				</Sidebar.GroupLabel>

				<Sidebar.Menu class="gap-[2px] ">
					{#each recentChats as chat}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton class="h-8 cursor-pointer px-3 font-geist text-sm text-[#989595]">
								{#snippet child({ props })}
									<button {...props} class={(props.class as string) + ' w-full text-left overflow-hidden'}>
										{#if chat.length > 25}
											<Tooltip.Root>
												<Tooltip.Trigger>
													{#snippet child({ props: tooltipProps })}
														<span {...tooltipProps} class="block w-full truncate text-left">{chat}</span>
													{/snippet}
												</Tooltip.Trigger>
												<Tooltip.Content side="right" class="max-w-xs break-words bg-white text-black">
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
								<DropdownMenu.Content class="w-48 border-white/10 bg-[#1C1B1B] text-[#C7C4D8]">
									<DropdownMenu.Item
										class="cursor-pointer text-white hover:bg-[#33281D] hover:text-white focus:bg-[#33281D] focus:text-white"
									>
										<Share class="mr-2 size-4" />
										<span>Share</span>
									</DropdownMenu.Item>
									<DropdownMenu.Item
										class="cursor-pointer text-white hover:bg-[#33281D] hover:text-white focus:bg-[#33281D] focus:text-white"
									>
										<Edit class="mr-2 size-4" />
										<span>Edit</span>
									</DropdownMenu.Item>
									<DropdownMenu.Item
										class="cursor-pointer text-white hover:bg-[#33281D] hover:text-white focus:bg-[#33281D] focus:text-white"
									>
										<Pin class="mr-2 size-4" />
										<span>Pin</span>
									</DropdownMenu.Item>
									<DropdownMenu.Separator class="bg-white/10" />
									<DropdownMenu.Item
										class="cursor-pointer text-red-400 hover:bg-red-400 hover:text-red-300 focus:bg-red-400 focus:text-red-300"
									>
										<Trash2 class="mr-2 size-4" />
										<span>Delete</span>
									</DropdownMenu.Item>
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</Sidebar.MenuItem>
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
								class="w-full cursor-pointer p-2 hover:bg-[#FF954B]/[0.06] data-[state=open]:bg-[#FF954B]/[0.06]"
							>
								<AvatarPrimitive.Root class="size-8 shrink-0 rounded-md border-none bg-[#D9D9D9]">
									<AvatarPrimitive.Fallback
										class="rounded-md bg-[#D9D9D9] font-geist text-sm font-medium text-[#1C1B1B]"
										>KH</AvatarPrimitive.Fallback
									>
								</AvatarPrimitive.Root>
								<div
									class="ml-2 flex flex-1 flex-col items-start justify-center gap-0.5 overflow-hidden group-data-[collapsible=icon]:hidden"
								>
									<span class="truncate font-geist text-sm font-medium text-white">Kanz Hamada</span
									>
									<span class="truncate font-geist text-xs text-[#989595]">Free</span>
								</div>
								<ChevronsUpDown
									class="size-4 shrink-0 text-white opacity-50 group-data-[collapsible=icon]:hidden"
								/>
							</Sidebar.MenuButton>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content
						side="right"
						align="end"
						class="mb-2 w-56 min-w-56 rounded-lg border-white/10 bg-[#1C1B1B] text-[#C7C4D8]"
					>
						<DropdownMenu.Label class="p-2 font-geist text-xs font-medium text-[#989595]"
							>My Account</DropdownMenu.Label
						>
						<DropdownMenu.Separator class="bg-white/10" />
						<DropdownMenu.Group>
							<DropdownMenu.Item
								class="cursor-pointer text-white hover:bg-[#33281D] hover:text-white focus:bg-[#33281D] focus:text-white"
							>
								<span>Settings</span>
							</DropdownMenu.Item>
							<DropdownMenu.Item
								class="cursor-pointer text-white hover:bg-[#33281D] hover:text-white focus:bg-[#33281D] focus:text-white"
							>
								<span>Billing</span>
							</DropdownMenu.Item>
						</DropdownMenu.Group>
						<DropdownMenu.Separator class="bg-white/10" />
						<DropdownMenu.Item
							class="cursor-pointer text-white hover:bg-[#33281D] hover:text-white focus:bg-[#33281D] focus:text-white"
						>
							<span>Log out</span>
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>
</Sidebar.Root>
