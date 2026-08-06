<script lang="ts">
	import { Copy, Check, Workflow, Code2, Eye, FileCode } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import mermaid from 'mermaid';

	let {
		code = '',
		language = 'code'
	}: {
		code: string;
		language?: string;
	} = $props();

	let isCopied = $state(false);
	let activeTab = $state<'diagram' | 'code'>(language === 'mermaid' ? 'diagram' : 'code');
	let mermaidSvgHtml = $state<string>('');
	let mermaidError = $state<string | null>(null);
	let containerId = $state(`mermaid-${Math.random().toString(36).substring(2, 9)}`);

	$effect(() => {
		if (language === 'mermaid' && code) {
			renderMermaid();
		}
	});

	async function renderMermaid() {
		try {
			mermaid.initialize({
				startOnLoad: false,
				theme: 'base',
				themeVariables: {
					darkMode: true,
					background: 'transparent',
					mainBkg: '#2B2A29',
					secondBkg: '#232323',
					lineColor: '#DB8F5E',
					border1: '#DB8F5E',
					border2: '#E59C6D',
					arrowheadColor: '#DB8F5E',
					fontFamily: 'Inter, system-ui, sans-serif',
					fontSize: '13px',
					primaryColor: '#2B2A29',
					primaryTextColor: '#FFFFFF',
					primaryBorderColor: '#DB8F5E',
					nodeBorder: '#DB8F5E',
					clusterBkg: '#1F1E1D',
					clusterBorder: '#DB8F5E',
					defaultLinkColor: '#DB8F5E',
					titleColor: '#FFFFFF',
					edgeLabelBackground: '#232323'
				}
			});

			// Render diagram using unique ID
			const renderId = `mermaid-svg-${Math.random().toString(36).substring(2, 9)}`;
			const { svg } = await mermaid.render(renderId, code.trim());
			mermaidSvgHtml = svg;
			mermaidError = null;
		} catch (err: any) {
			console.error('Mermaid render error:', err);
			mermaidError = err?.message || 'Failed to render diagram';
		}
	}

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(code);
			isCopied = true;
			toast.success('Code copied to clipboard');
			setTimeout(() => {
				isCopied = false;
			}, 2000);
		} catch (e) {
			toast.error('Failed to copy code');
		}
	}
</script>

<div class="my-4 overflow-hidden rounded-xl border border-white/15 bg-[#1C1B1A] shadow-xl backdrop-blur-md">
	<!-- Header Bar -->
	<div class="flex items-center justify-between border-b border-white/10 bg-[#252423] px-3.5 py-2">
		<!-- Left: Language Badge -->
		<div class="flex items-center gap-2 text-xs font-medium tracking-wider text-white/70 uppercase">
			{#if language === 'mermaid'}
				<Workflow class="size-3.5 text-[#DB8F5E]" />
				<span>Mermaid Diagram</span>
			{:else}
				<Code2 class="size-3.5 text-white/50" />
				<span>{language || 'code'}</span>
			{/if}
		</div>

		<!-- Middle: Segmented Tab Switcher for Mermaid -->
		{#if language === 'mermaid'}
			<div class="flex items-center gap-1 rounded-lg border border-white/10 bg-black/40 p-0.5 text-xs">
				<button
					type="button"
					class="flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors {activeTab === 'diagram'
						? 'bg-[#DB8F5E] font-medium text-black shadow-xs'
						: 'text-white/60 hover:text-white'}"
					onclick={() => (activeTab = 'diagram')}
				>
					<Eye class="size-3" />
					<span>Diagram</span>
				</button>
				<button
					type="button"
					class="flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors {activeTab === 'code'
						? 'bg-[#DB8F5E] font-medium text-black shadow-xs'
						: 'text-white/60 hover:text-white'}"
					onclick={() => (activeTab = 'code')}
				>
					<FileCode class="size-3" />
					<span>Code</span>
				</button>
			</div>
		{/if}

		<!-- Right: Copy Code Button -->
		<button
			type="button"
			class="flex cursor-pointer items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white focus:outline-none"
			onclick={handleCopy}
		>
			{#if isCopied}
				<Check class="size-3.5 text-green-400" />
				<span class="text-green-400">Copied!</span>
			{:else}
				<Copy class="size-3.5 text-white/60" />
				<span>Copy</span>
			{/if}
		</button>
	</div>

	<!-- Content View -->
	{#if language === 'mermaid' && activeTab === 'diagram'}
		<div class="flex min-h-[160px] items-center justify-center overflow-x-auto bg-[#161514] p-6">
			{#if mermaidError}
				<div class="max-w-md text-center text-xs text-red-400/90">
					<p class="font-medium">Diagram Syntax Error</p>
					<p class="mt-1 font-mono text-[11px] text-white/40">{mermaidError}</p>
				</div>
			{:else if mermaidSvgHtml}
				<div class="mermaid-container flex w-full justify-center overflow-x-auto [&_svg]:max-w-full [&_svg]:h-auto">
					{@html mermaidSvgHtml}
				</div>
			{:else}
				<div class="flex items-center gap-2 text-xs text-white/40">
					<div class="size-3.5 animate-spin rounded-full border-2 border-white/20 border-t-[#DB8F5E]"></div>
					<span>Rendering diagram...</span>
				</div>
			{/if}
		</div>
	{:else}
		<pre class="m-0 overflow-x-auto p-4 font-mono text-xs leading-relaxed text-white/90 scrollbar-thin scrollbar-thumb-white/15 scrollbar-track-transparent"><code>{code}</code></pre>
	{/if}
</div>
