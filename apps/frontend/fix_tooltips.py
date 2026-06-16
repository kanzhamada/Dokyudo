import re
import sys

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # We need to find:
    # <Tooltip.Trigger asChild>
    # \s*<([a-zA-Z]+) 
    # and replace with
    # <Tooltip.Trigger>\n{#snippet child({ props })}\n<\1 {...props} 
    # And then we need to find the matching closing tag and </Tooltip.Trigger> and close the snippet.
    
    # Since regex for matching HTML blocks can be tricky, let's just do it sequentially.
    
    # Replace the opening part:
    content = re.sub(
        r'<Tooltip\.Trigger asChild>\s*<([a-zA-Z]+)\s',
        r'<Tooltip.Trigger>\n\t\t\t\t{#snippet child({ props })}\n\t\t\t\t\t<\1 {...props} ',
        content
    )
    # Some buttons are indented differently, but adding some tabs is fine.
    
    # Replace the closing part:
    content = re.sub(
        r'</([a-zA-Z]+)>\s*</Tooltip\.Trigger>',
        r'</\1>\n\t\t\t\t{/snippet}\n\t\t\t</Tooltip.Trigger>',
        content
    )
    
    with open(filepath, 'w') as f:
        f.write(content)

fix_file('/home/kanz/Projects/Dokyudo/apps/frontend/src/routes/(auth)/login/+page.svelte')
fix_file('/home/kanz/Projects/Dokyudo/apps/frontend/src/routes/(auth)/signup/+page.svelte')
