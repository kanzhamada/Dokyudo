import re

with open('apps/frontend/src/lib/components/app/AppSidebar.svelte', 'r') as f:
    content = f.read()

# Replace the <Sidebar.M \n <Sidebar.Menu> glitch
content = content.replace("<Sidebar.M\n\t\t<Sidebar.Menu>", "<Sidebar.Menu>")

# Since the file is 271 lines, doing a regex is brittle.
# I will just write a new file completely using Svelte snippets.

# No wait, regex for the navItems loop is perfectly fine:
nav_snippet = """
{#snippet navItem(item)}
	<Sidebar.MenuItem>
		<Sidebar.MenuButton
			isActive={item.active}
			tooltipContent={item.label}
			class="h-10 px-3 font-geist text-[15px]"
		>
			{#snippet child({ props })}
				<a href="##" {...props}>
					<item.icon class="mr-3 size-[18px] group-data-[collapsible=icon]:mr-0" />
					<span class="group-data-[collapsible=icon]:hidden">{item.label}</span>
				</a>
			{/snippet}
		</Sidebar.MenuButton>
	</Sidebar.MenuItem>
{/snippet}
"""

nav_loop_regex = r"\{#each navItems as item\}.*?\{\/each\}"
content = re.sub(nav_loop_regex, "{#each navItems as item}\n\t\t\t\t\t\t{@render navItem(item)}\n\t\t\t\t\t{/each}", content, flags=re.DOTALL)

recent_snippet = """
{#snippet recentChatItem(chat)}
	<Sidebar.MenuItem>
		<Sidebar.MenuButton class="h-8 cursor-pointer px-3 font-geist text-sm text-sidebar-muted-foreground">
			{#snippet child({ props })}
				<button {...props} class={(props.class as string) + ' w-full text-left overflow-hidden'}>
					{#if chat.length > 25}
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props: tooltipProps })}
									<span {...tooltipProps} class="block w-full truncate text-left">{chat}</span>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content side="right" class="max-w-xs break-words">
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
"""

recent_loop_regex = r"\{#each recentChats as chat\}.*?\{\/each\}"
content = re.sub(recent_loop_regex, "{#each recentChats as chat}\n\t\t\t\t\t\t{@render recentChatItem(chat)}\n\t\t\t\t\t{/each}", content, flags=re.DOTALL)


# Put snippets at the bottom of the file
content += "\n" + nav_snippet + "\n" + recent_snippet + "\n"

with open('apps/frontend/src/lib/components/app/AppSidebar.svelte', 'w') as f:
    f.write(content)
