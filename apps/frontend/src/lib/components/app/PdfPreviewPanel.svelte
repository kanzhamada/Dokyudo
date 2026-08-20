<script lang="ts">
	import { PDFViewer } from '@embedpdf/svelte-pdf-viewer';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert';
	import MxIcon from '$lib/components/icons/MxIcon.svelte';

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

	function triggerHaptic(duration = 20) {
		if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
			try {
				navigator.vibrate(duration);
			} catch {
				// Unsupported
			}
		}
	}

	/* ── Mobile Swipe-Down to Dismiss ── */
	let touchStartY = $state(0);
	let touchCurrentY = $state(0);
	let isDragging = $state(false);
	let dragOffsetY = $state(0);
	let isClosing = $state(false);

	function handleTouchStart(e: TouchEvent) {
		if (typeof window !== 'undefined' && window.innerWidth >= 768) return;
		if (!onclose) return;
		if (e.touches.length !== 1) return;
		const target = e.target as HTMLElement;
		if (target.closest('button') || target.closest('a') || target.closest('input')) return;

		touchStartY = e.touches[0].clientY;
		touchCurrentY = touchStartY;
		isDragging = true;
		dragOffsetY = 0;
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isDragging) return;
		touchCurrentY = e.touches[0].clientY;
		const deltaY = touchCurrentY - touchStartY;
		if (deltaY > 0) {
			dragOffsetY = deltaY;
		} else {
			dragOffsetY = deltaY * 0.15;
		}
	}

	function handleTouchEnd() {
		if (!isDragging) return;
		isDragging = false;

		const deltaY = touchCurrentY - touchStartY;
		const dismissThreshold = 80;

		if (deltaY > dismissThreshold) {
			triggerHaptic(20);
			isClosing = true;
			dragOffsetY = typeof window !== 'undefined' ? window.innerHeight : 600;
			setTimeout(() => {
				onclose?.();
			}, 220);
		} else {
			dragOffsetY = 0;
		}
	}

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
				app: 'oklch(17.5% 0.01 65)',
				surface: 'oklch(26% 0.02 68)',
				surfaceAlt: 'oklch(17.5% 0.01 65)',
				elevated: 'oklch(26% 0.02 68)',
				overlay: 'rgba(0, 0, 0, 0.5)',
				input: 'rgba(255, 255, 255, 0.05)'
			},
			foreground: {
				primary: 'oklch(98.3% 0.005 87)',
				secondary: 'rgba(255, 255, 255, 0.6)',
				muted: 'oklch(69.8% 0.03 68)',
				disabled: 'rgba(255, 255, 255, 0.2)',
				onAccent: 'oklch(17.5% 0.01 65)'
			},
			border: {
				default: 'rgba(255, 255, 255, 0.1)',
				subtle: 'rgba(255, 255, 255, 0.05)',
				strong: 'rgba(255, 255, 255, 0.2)'
			},
			accent: {
				primary: 'oklch(67.4% 0.15 52)',
				primaryHover: 'oklch(53.2% 0.134 48)',
				primaryActive: 'oklch(60% 0.14 50)',
				primaryLight: 'oklch(38% 0.028 66)',
				primaryForeground: 'oklch(17.5% 0.01 65)'
			},
			interactive: {
				hover: 'rgba(255, 255, 255, 0.1)',
				active: 'rgba(255, 255, 255, 0.15)',
				selected: 'oklch(from oklch(67.4% 0.15 52) l c h / 0.2)',
				focus: 'oklch(67.4% 0.15 52)',
				focusRing: 'oklch(from oklch(67.4% 0.15 52) l c h / 0.5)'
			},
			state: {
				error: 'oklch(68% 0.16 28)',
				errorLight: 'rgba(239, 68, 68, 0.1)',
				warning: 'oklch(76% 0.08 82)',
				warningLight: 'rgba(234, 179, 8, 0.1)',
				success: 'oklch(76% 0.07 128)',
				successLight: 'rgba(34, 197, 94, 0.1)',
				info: 'oklch(76% 0.04 235)',
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
<div
	class="pdf-panel relative flex h-full w-full flex-col overflow-hidden bg-dk-bg p-3 sm:p-4 md:p-5"
	style={dragOffsetY !== 0 || isClosing
		? `transform: translateY(${Math.max(0, dragOffsetY)}px); transition: ${isDragging ? 'none' : 'transform 220ms cubic-bezier(0.32, 0.72, 0, 1), opacity 220ms ease'}; opacity: ${isClosing ? 0 : Math.max(0.4, 1 - dragOffsetY / 500)};`
		: ''}
>
	<!-- Sheet Handle & Swipe-Down Zone for Mobile -->
	<div
		class="sheet-handle-zone md:hidden"
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		ontouchend={handleTouchEnd}
		ontouchcancel={handleTouchEnd}
		role="button"
		tabindex="0"
		aria-label="Swipe down to close"
	>
		<div
			class="sheet-handle {isDragging && dragOffsetY > 8 ? 'sheet-handle-active' : ''}"
			aria-hidden="true"
		></div>
	</div>

	<!-- Header: document name + close button -->
	<div
		class="panel-header relative mt-6 mb-3 flex items-start justify-between gap-3 md:mt-0"
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		ontouchend={handleTouchEnd}
		ontouchcancel={handleTouchEnd}
	>
		<div class="min-w-0 flex-1">
			<div class="flex min-w-0 items-start gap-2">
				<h3
					class="line-clamp-2 min-w-0 font-geist text-base leading-snug font-medium text-dk-light sm:text-lg"
					title={name}
				>
					{name}
				</h3>
				<span class="status-chip mt-0.5 shrink-0">Read only</span>
			</div>
			<div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
				<p
					class="warning-note flex min-w-0 items-start gap-1.5 text-[11px] leading-relaxed text-dk-copper sm:text-xs"
				>
					<AlertTriangleIcon
						class="mt-0.5 size-3.5 shrink-0"
						strokeWidth={1.8}
						aria-hidden="true"
					/>
					<span>Preview edits aren't saved. Export the document to keep changes.</span>
				</p>
			</div>
		</div>
		{#if onclose}
			<Tooltip.Provider delayDuration={100}>
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<button
								{...props}
								type="button"
								class="close-button cursor-pointer select-none rounded-full text-dk-muted-gray transition-all duration-150 hover:bg-white/10 hover:text-dk-light active:scale-90"
								onclick={() => {
									triggerHaptic(15);
									onclose?.();
								}}
								aria-label="Close document preview"
							>
								<MxIcon name="close-circle-linear" class="size-4" />
							</button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content
						class="rounded-md border-0 bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
					>
						<p>Close preview</p>
					</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		{/if}
	</div>

	<!-- PDF Viewer body -->
	<div
		class="viewer-frame flex min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-white/5"
	>
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

<style>
	.pdf-panel {
		isolation: isolate;
		background: var(--color-black);
	}

	.pdf-panel::before {
		position: absolute;
		top: -19.875rem;
		left: -18.4375rem;
		z-index: 0;
		height: 74.375rem;
		width: 74.375rem;
		border-radius: 999px;
		background: linear-gradient(180deg, var(--color-white) 0%, var(--color-terracotta-deep) 100%);
		filter: blur(99px);
		opacity: 0.07;
		content: '';
		pointer-events: none;
	}

	.pdf-panel::after {
		position: absolute;
		top: 0;
		right: 1.25rem;
		left: 1.25rem;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.18), transparent);
		content: '';
		pointer-events: none;
	}

	.panel-header {
		animation: panel-enter 560ms cubic-bezier(0.32, 0.72, 0, 1) both;
	}

	.viewer-frame {
		position: relative;
		z-index: 1;
		box-shadow: inset 0 1px 0 oklch(from var(--color-offwhite) l c h / 0.06);
		animation: viewer-enter 680ms cubic-bezier(0.32, 0.72, 0, 1) 80ms both;
	}

	.status-chip {
		border: 1px solid oklch(from var(--color-offwhite) l c h / 0.1);
		border-radius: 999px;
		background: oklch(from var(--color-offwhite) l c h / 0.045);
		padding: 0.2rem 0.45rem;
		font-size: 0.625rem;
		line-height: 1;
		letter-spacing: 0.08em;
		white-space: nowrap;
		color: oklch(from var(--color-offwhite) l c h / 0.52);
	}

	.warning-note {
		transition: color 500ms cubic-bezier(0.32, 0.72, 0, 1);
	}

	.panel-header:hover .warning-note {
		color: var(--color-terracotta);
	}

	:global(.close-button) {
		border: 1px solid oklch(from var(--color-offwhite) l c h / 0.08);
		background: oklch(from var(--color-offwhite) l c h / 0.04);
		transition:
			background-color 500ms cubic-bezier(0.32, 0.72, 0, 1),
			color 500ms cubic-bezier(0.32, 0.72, 0, 1),
			transform 500ms cubic-bezier(0.32, 0.72, 0, 1);
	}

	.sheet-handle-zone {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 2.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 20;
		cursor: grab;
		touch-action: none;
	}

	.sheet-handle {
		height: 0.28rem;
		width: 2.5rem;
		border-radius: 999px;
		background: oklch(from var(--color-offwhite) l c h / 0.25);
		transition:
			background-color 200ms cubic-bezier(0.32, 0.72, 0, 1),
			width 200ms cubic-bezier(0.32, 0.72, 0, 1),
			transform 200ms cubic-bezier(0.32, 0.72, 0, 1);
	}

	.sheet-handle-active {
		background: oklch(from var(--color-terracotta) l c h / 0.85);
		width: 3.25rem;
		transform: scale(1.05);
	}

	@keyframes panel-enter {
		from {
			transform: translateY(0.5rem);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	@keyframes viewer-enter {
		from {
			transform: translateY(0.75rem);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.panel-header,
		.viewer-frame {
			animation: none;
		}

		.warning-note,
		:global(.close-button) {
			transition: none;
		}
	}

	:global(button),
	:global(a) {
		-webkit-tap-highlight-color: rgba(255, 255, 255, 0.08);
		-webkit-touch-callout: none;
		touch-action: manipulation;
	}
</style>
