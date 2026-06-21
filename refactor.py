import re

with open('apps/frontend/src/lib/components/app/AppSidebar.svelte', 'r') as f:
    content = f.read()

# Replace colors
content = content.replace('bg-[#1C1B1B]', 'bg-sidebar')
content = content.replace('text-[#1C1B1B]', 'text-sidebar')
content = content.replace('fill-[#C5937B]', 'fill-sidebar-primary')
content = content.replace('text-[#C5937B]', 'text-sidebar-primary')
content = content.replace('text-[#676767]', 'text-sidebar-muted')
content = content.replace('text-[#989595]', 'text-sidebar-muted-foreground')
content = content.replace('bg-[#D9D9D9]', 'bg-sidebar-avatar')
content = content.replace('text-[#C7C4D8]', 'text-sidebar-foreground')
content = content.replace('hover:bg-[#FF954B]/[0.06]', 'hover:bg-sidebar-accent')
content = content.replace('data-[state=open]:bg-[#FF954B]/[0.06]', 'data-[state=open]:bg-sidebar-accent')

# Dropdown hovers
content = re.sub(r'hover:bg-\[#33281D\] hover:text-white focus:bg-\[#33281D\] focus:text-white', 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus:bg-sidebar-accent focus:text-sidebar-accent-foreground', content)
content = re.sub(r'hover:bg-\[#2B2A2A\] hover:text-white focus:bg-\[#2B2A2A\] focus:text-white', 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus:bg-sidebar-accent focus:text-sidebar-accent-foreground', content)

with open('apps/frontend/src/lib/components/app/AppSidebar.svelte', 'w') as f:
    f.write(content)
