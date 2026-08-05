<script lang="ts">
	import { PDFViewer } from '@embedpdf/svelte-pdf-viewer';
	import { Button } from '$lib/components/ui/button/index.js';
	import XIcon from '@lucide/svelte/icons/x';

	interface Props {
		/** Document URL (signed S3 URL) to render inside the PDF viewer */
		src: string;
		/** Display name shown in the viewer header */
		name: string;
		/**
		 * Optional page numbers to scroll to on initial load.
		 * The viewer will jump to the first page in the array once the layout is ready.
		 */
		initialPages?: number[];
		/** Called when the user presses the close (X) button */
		onclose?: () => void;
	}

	let { src, name, initialPages = [], onclose }: Props = $props();

	// Scroll plugin reference — captured once on viewer ready
	let scrollCap: any = null;
	let isFirstLayoutReady = true;

	function handleReady(registry: any) {
		const scrollPlugin = registry.getPlugin('scroll');
		if (!scrollPlugin?.provides) return;

		scrollCap = scrollPlugin.provides();
		scrollCap.onLayoutReady((event: any) => {
			if (event.isInitial && initialPages.length > 0) {
				scrollCap.scrollToPage({ pageNumber: initialPages[0] });
			}
		});
	}

	// When initialPages changes after first load, scroll to the new page
	$effect(() => {
		const page = initialPages[0];
		if (!page || !scrollCap || isFirstLayoutReady) {
			isFirstLayoutReady = false;
			return;
		}
		scrollCap.scrollToPage({ pageNumber: page });
	});

	// Dokyudo dark-mode theme tokens shared across all PDF viewer instances
	const darkTheme = {
		preference: 'dark',
		dark: {
			background: {
				app: '#191919',
				surface: '#2A2A2A',
				surfaceAlt: '#1F1E1D',
				elevated: '#2A2A2A',
				overlay: 'rgba(0, 0, 0, 0.5)',
				input: 'rgba(255, 255, 255, 0.05)'
			},
			foreground: {
				primary: '#ffffff',
				secondary: 'rgba(255, 255, 255, 0.6)',
				muted: 'rgba(255, 255, 255, 0.4)',
				disabled: 'rgba(255, 255, 255, 0.2)',
				onAccent: '#ffffff'
			},
			border: {
				default: 'rgba(255, 255, 255, 0.1)',
				subtle: 'rgba(255, 255, 255, 0.05)',
				strong: 'rgba(255, 255, 255, 0.2)'
			},
			accent: {
				primary: '#DB8F5E',
				primaryHover: '#E59C6D',
				primaryActive: '#F0AA81',
				primaryLight: '#4a2f20',
				primaryForeground: '#ffffff'
			},
			interactive: {
				hover: 'rgba(255, 255, 255, 0.1)',
				active: 'rgba(255, 255, 255, 0.15)',
				selected: 'rgba(219, 143, 94, 0.2)',
				focus: '#DB8F5E',
				focusRing: 'rgba(219, 143, 94, 0.5)'
			},
			state: {
				error: '#ef4444',
				errorLight: 'rgba(239, 68, 68, 0.1)',
				warning: '#eab308',
				warningLight: 'rgba(234, 179, 8, 0.1)',
				success: '#22c55e',
				successLight: 'rgba(34, 197, 94, 0.1)',
				info: '#3b82f6',
				infoLight: 'rgba(59, 130, 246, 0.1)'
			}
		}
	} as const;
</script>

<!--
	PdfPreviewPanel — Reusable PDF viewer panel with Dokyudo dark theme.

	Usage (documents page):
	  <PdfPreviewPanel src={doc.url} name={doc.name} initialPages={doc.pages} onclose={() => previewDocument = null} />

	Usage (chat citation):
	  <PdfPreviewPanel src={citationUrl} name={refName} initialPages={[citedPage]} onclose={closeSidePanel} />
-->
<div class="flex h-full w-full flex-col bg-[#191919] p-6">
	<!-- Header: document name + close button -->
	<div class="mt-16 mb-4 flex items-start justify-between gap-4 md:mt-0">
		<div class="flex flex-col gap-1">
			<h3 class="line-clamp-1 text-lg font-medium text-white" title={name}>
				{name}
			</h3>
			<p class="text-xs text-[#DB8F5E]/90">
				* Note: Edits made here won't be saved to the database. Please export the document to keep
				your changes.
			</p>
		</div>
		{#if onclose}
			<Button
				variant="ghost"
				size="icon"
				class="cursor-pointer text-white/60 hover:bg-white/5 hover:text-white"
				onclick={onclose}
			>
				<XIcon class="size-5" />
			</Button>
		{/if}
	</div>

	<!-- PDF Viewer body -->
	<div class="flex-1 overflow-hidden rounded-xl border border-white/10 bg-white/5">
		{#key src}
			<PDFViewer
				class="h-full w-full"
				onready={handleReady}
				config={{
					src,
					theme: darkTheme
				}}
			/>
		{/key}
	</div>
</div>
