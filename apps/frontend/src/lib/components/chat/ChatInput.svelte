<script lang="ts">
	import {
		Paperclip,
		SendHorizontal,
		ChevronDown,
		X,
		Square,
		Settings2,
		Check,
		FileText,
		Loader2
	} from 'lucide-svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { toast } from 'svelte-sonner';
	import { mobileHeaderState } from '$lib/state/mobile-header.svelte.js';
	import { documentsStore } from '$lib/state/documents.store.svelte';
	import type { DocumentItem } from '$lib/api/documents';
	import { mentionToken, parseMentionIds, splitMentionSegments } from '$lib/utils/doc-mentions';

	interface LlmOption {
		name: string;
		provider: string;
		model: string;
		icon: string;
	}

	interface ModelGroup {
		provider: string;
		label: string;
		options: LlmOption[];
	}

	let {
		value = $bindable(''),
		attachedFiles = $bindable([] as File[]),
		selectedModel = $bindable({ name: '', provider: 'auto', model: 'auto', icon: '' } as LlmOption),
		llmOptions = [] as LlmOption[],
		placeholder = 'Ask a follow-up question...',
		showModelSelector = true,
		isGenerating = false,
		/** True while attached files are being uploaded before the turn is sent. */
		isUploading = false,
		/** True = transparent/soft capsule look (used by /app/chat landing page). */
		transparent = false,
		onsend = () => {},
		onstop = () => {},
		onconfigure = null as (() => void) | null,
		/** Re-focus the textarea whenever this key changes (e.g. chat <-> search mode toggle). */
		refocusKey = '',
		baseUploads = 0,
		maxUploads = 10,
		baseStorage = 0,
		maxStorage = 100 * 1024 * 1024,
		maxFileSizeBytes = 10 * 1024 * 1024
	} = $props();

	let textInput: HTMLTextAreaElement | null = $state(null);
	let fileInput: HTMLInputElement | null = $state(null);
	let modelSearchQuery = $state('');

	// ---- Document mention (`@`) popover state ----
	let mentionOpen = $state(false);
	let mentionQuery = $state('');
	let mentionHighlight = $state(0);
	/** Element refs of the popover items — drives scroll-into-view on keyboard nav. */
	let mentionItemEls: (HTMLButtonElement | undefined)[] = [];
	/** Overlay that renders mention tokens as badges behind the transparent textarea. */
	let mentionOverlay: HTMLDivElement | null = $state(null);

	// Keep the highlighted item visible while navigating with ↑/↓.
	$effect(() => {
		if (!mentionOpen) return;
		mentionItemEls[mentionHighlight]?.scrollIntoView({ block: 'nearest' });
	});

	// Mirror the textarea scroll position onto the badge overlay (both wrap and
	// scroll together).
	$effect(() => {
		value;
		if (mentionOverlay && textInput) {
			mentionOverlay.scrollTop = textInput.scrollTop;
		}
	});

	function syncMentionOverlayScroll() {
		if (mentionOverlay && textInput) {
			mentionOverlay.scrollTop = textInput.scrollTop;
		}
	}

	let mentionCandidates = $derived.by(() => {
		if (!mentionOpen) return [];
		const q = mentionQuery.trim().toLowerCase();
		// Exclude documents already referenced by an inline token in the text.
		const mentionedIds = new Set(parseMentionIds(value));
		// Only indexed ("processed") documents are usable as main context — the
		// backend streams an answer from them immediately. Anything still
		// ingesting (pending/confirmed) belongs to the file-upload flow, not
		// the `@` mention.
		return documentsStore.list
			.filter((d) => d.status === 'processed' && !mentionedIds.has(d.id))
			.filter((d) => !q || d.title.toLowerCase().includes(q))
			.sort((a, b) => a.title.localeCompare(b.title))
			.slice(0, 30);
	});

	let currentUploadCount = $derived(baseUploads + attachedFiles.length);
	let currentStorageBytes = $derived(
		baseStorage + attachedFiles.reduce((acc, file) => acc + file.size, 0)
	);
	let maxFileSizeMB = $derived((maxFileSizeBytes / (1024 * 1024)).toFixed(0));

	// Grouped model options (with search) — used when a Configure callback is provided.
	let modelGroups = $derived.by(() => {
		const query = modelSearchQuery.trim().toLowerCase();
		const groupLabels: Record<string, string> = {
			auto: 'Free Models Router',
			gemini: 'Google AI',
			mistral: 'Mistral',
			openrouter: 'OpenRouter'
		};
		const groupOrder = ['auto', 'gemini', 'mistral', 'openrouter'];

		return groupOrder
			.map((provider) => ({
				provider,
				label: groupLabels[provider],
				options: llmOptions.filter(
					(option) =>
						option.provider.toLowerCase() === provider &&
						(!query ||
							option.name.toLowerCase().includes(query) ||
							groupLabels[provider].toLowerCase().includes(query))
				)
			}))
			.filter((group) => group.options.length > 0);
	});

	// Auto-reset textarea height when input is cleared
	$effect(() => {
		if (!value && textInput) {
			textInput.style.height = 'auto';
		}
	});

	// Focus on mount, and re-focus whenever the caller asks (refocusKey changes)
	$effect(() => {
		refocusKey;
		setTimeout(() => textInput?.focus(), 0);
	});

	function showError(msg: string) {
		if (window.matchMedia('(max-width: 767px)').matches) {
			mobileHeaderState.showError(msg);
		} else {
			toast.error('Error', { description: msg });
		}
	}

	function triggerFileInput() {
		if (fileInput) fileInput.click();
	}

	function handleFileChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			const validFiles: File[] = [];

			for (let i = 0; i < target.files.length; i++) {
				const file = target.files[i];

				// 0. Extension validation (must match the backend upload contract)
				const allowedExtensions = ['.pdf', '.txt'];
				const lowerName = file.name.toLowerCase();
				if (!allowedExtensions.some((ext) => lowerName.endsWith(ext))) {
					showError(`File "${file.name}" has an invalid extension. Only PDF and TXT are allowed.`);
					continue;
				}

				// 1. Individual size check per tier limit
				if (file.size > maxFileSizeBytes) {
					showError(
						`File "${file.name}" exceeds the ${maxFileSizeMB}MB limit for your plan and was rejected.`
					);
					continue;
				}

				// 2. Global count check
				if (attachedFiles.length + validFiles.length + 1 > maxUploads - baseUploads) {
					showError(`Cannot attach "${file.name}": Exceeds maximum upload limit of ${maxUploads}.`);
					continue;
				}

				// 3. Global size check
				const upcomingSize =
					currentStorageBytes + validFiles.reduce((acc, f) => acc + f.size, 0) + file.size;
				if (upcomingSize > maxStorage) {
					showError(`Cannot attach "${file.name}": Exceeds storage limit for your plan.`);
					continue;
				}

				validFiles.push(file);
			}

			if (validFiles.length > 0) {
				attachedFiles = [...attachedFiles, ...validFiles];
			}
			target.value = ''; // Reset input to allow selecting the same file again
		}
	}

	function removeFile(index: number) {
		attachedFiles.splice(index, 1);
	}

	/** Detects an in-progress `@query` token right before the caret. */
	function updateMentionState() {
		const el = textInput;
		if (!el) return;
		const pos = el.selectionStart ?? el.value.length;
		const before = el.value.slice(0, pos);
		const match = before.match(/(?:^|\s)@([^\s@]*)$/);
		if (match) {
			// A caret right after an existing `@[title](id)` token is not a new
			// mention — the query would start with `[`.
			if (match[1].startsWith('[')) {
				closeMention();
				return;
			}
			mentionQuery = match[1];
			if (!mentionOpen) {
				mentionOpen = true;
				mentionHighlight = 0;
				// Warm the cache the first time the popover opens — idempotent,
				// no-op when the store was already loaded by the page on mount.
				documentsStore.ensureLoaded();
			}
		} else {
			closeMention();
		}
	}

	function closeMention() {
		mentionOpen = false;
		mentionQuery = '';
	}

	function selectMention(doc: DocumentItem) {
		const el = textInput;
		if (!el) return;
		// Replace the `@query` prefix with the inline `@[title](id)` token —
		// the token lives in the question text itself (stored with the turn)
		// and is rendered back as a clickable tag in the message bubble. A
		// trailing space keeps the next word from merging into the token.
		const pos = el.selectionStart ?? el.value.length;
		const before = el.value.slice(0, pos);
		const prefix = before.replace(/@[^\s@]*$/, '');
		value = prefix + mentionToken(doc.title, doc.id) + ' ' + el.value.slice(pos);
		closeMention();
		el.focus();
	}

	function handleSendClick() {
		if (isGenerating) onstop();
		else onsend();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (mentionOpen) {
			const count = Math.max(1, mentionCandidates.length);
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				mentionHighlight = (mentionHighlight + 1) % count;
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				mentionHighlight = (mentionHighlight - 1 + count) % count;
				return;
			}
			if (e.key === 'Enter') {
				e.preventDefault();
				const doc = mentionCandidates[mentionHighlight];
				if (doc) selectMention(doc);
				else closeMention();
				return;
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				closeMention();
				return;
			}
		}
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			onsend();
		}
	}
</script>

<!-- Main Input Capsule.
     The capsule is intentionally NOT given its own view-transition-name: it
     stays inside the `app-main` capture so it cross-fades with the content
     area as one flat unit (a separate capture would carve a rectangular hole
     in `app-main` and leave sharp corner artifacts during the transition). -->
<div
	class="group relative flex w-full flex-col gap-1 rounded-[24px] border border-white/[0.16] px-4 py-2 backdrop-blur-[42px] transition-all {transparent
		? 'bg-[#232323]/[0.40]'
		: 'bg-[#232323]/[0.85] shadow-2xl'}"
>
	<!-- Document mention popover (@ trigger) — floats above the capsule -->
	{#if mentionOpen}
		<div
			class="absolute right-0 bottom-full left-0 z-50 mb-2 overflow-hidden rounded-2xl border border-white/[0.16] bg-[#232323]/[0.95] text-white shadow-2xl backdrop-blur-[42px]"
			role="listbox"
			aria-label="Documents"
			tabindex="-1"
			onmousedown={(e) => e.preventDefault()}
		>
			<div class="max-h-64 overflow-y-auto p-1.5">
				{#if documentsStore.loading}
					<div class="flex items-center gap-2 px-3 py-2.5 text-sm text-white/50">
						<Loader2 class="size-4 animate-spin" />
						<span>Loading documents...</span>
					</div>
				{:else if mentionCandidates.length === 0}
					<div class="px-3 py-2.5 text-sm text-white/50">
						{documentsStore.hasError
							? 'Failed to load documents. Try again.'
							: 'No matching documents.'}
					</div>
				{:else}
					{#each mentionCandidates as doc, index (doc.id)}
						<button
							type="button"
							role="option"
							bind:this={mentionItemEls[index]}
							aria-selected={index === mentionHighlight}
							class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-white/75 transition-colors hover:bg-white/[0.12] hover:text-white {index ===
							mentionHighlight
								? 'bg-white/[0.12] text-white'
								: ''}"
							onmouseenter={() => (mentionHighlight = index)}
							onclick={() => selectMention(doc)}
						>
							<FileText class="size-4 shrink-0 text-white/60" />
							<span class="min-w-0 flex-1 truncate">{doc.title}</span>
						</button>
					{/each}
				{/if}
			</div>
		</div>
	{/if}

	<!-- Row 1: Attached Files -->
	{#if attachedFiles.length > 0}
		<div class="flex flex-wrap gap-2 pt-1 pb-1">
			{#each attachedFiles as file, index}
				<div
					class="flex items-center gap-2 rounded-full bg-[#121212]/[0.80] py-1.5 pr-2 pl-3 text-sm text-white/[0.80] backdrop-blur-[20px] transition-all"
				>
					<span class="max-w-[200px] truncate">{file.name}</span>
					<button
						class="flex cursor-pointer items-center justify-center rounded-full p-0.5 text-white/[0.40] transition-colors hover:bg-white/[0.16] hover:text-white"
						onclick={() => removeFile(index)}
						aria-label="Remove file"
					>
						<X class="size-3.5" />
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Row 2: Input Controls -->
	<div class="flex w-full flex-row items-end gap-3">
		<!-- Attach Document -->
		<div class="relative flex h-9 items-center">
			<Tooltip.Provider delayDuration={100}>
				<Tooltip.Root>
					<Tooltip.Trigger
						class="flex cursor-pointer items-center text-white/[0.40] transition-colors focus-within:text-white/[0.69] hover:text-white/[0.69]"
						aria-label="Attach Document"
						onclick={triggerFileInput}
					>
						<Paperclip class="size-5" />
					</Tooltip.Trigger>
					<Tooltip.Content
						class="flex flex-col gap-1 border-white/[0.16] bg-[#232323] text-white"
						arrowClasses="bg-[#232323] border-white/[0.16] border-b border-r"
					>
						<p>Attach Document (PDF, TXT)</p>
						<p class="text-xs text-white/[0.69]">
							{maxUploads - currentUploadCount} uploads remaining • Max {maxFileSizeMB}MB/file
						</p>
					</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		</div>
		<Input
			type="file"
			bind:ref={fileInput}
			id="file-upload"
			accept=".pdf,.txt"
			class="hidden"
			multiple
			onchange={handleFileChange}
		/>

		<!-- Input Text Field.
		     A textarea with transparent text + a badge overlay behind it: mention
		     tokens render as monochrome pills while the textarea keeps native
		     caret/selection/editing. The overlay mirrors the textarea's padding,
		     wrapping and scroll position so badges sit exactly on their text. -->
		<div class="relative min-w-0 flex-1">
			<div
				aria-hidden="true"
				bind:this={mentionOverlay}
				class="pointer-events-none absolute inset-0 max-h-32 scrollbar-thin scrollbar-thumb-transparent scrollbar-track-transparent overflow-y-auto px-3 py-1.5 text-sm break-words whitespace-pre-wrap {transparent
					? 'text-white/[0.40] group-focus-within:text-white/[0.69]'
					: 'text-white'}"
			>
				{#each splitMentionSegments(value) as seg, i}
					{#if seg.type === 'mention' && seg.id}
						<span
							class="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] leading-none font-medium text-white/80"
						>
							<FileText class="size-3 text-white/60" />
							{seg.title}
						</span>
					{:else}
						<span>{seg.text}</span>
					{/if}
				{/each}
			</div>
			<Textarea
				bind:ref={textInput}
				bind:value
				maxlength={690}
				rows={1}
				{placeholder}
				class="max-h-32 min-h-[36px] w-full resize-none scrollbar-thin scrollbar-thumb-white/[0.16] scrollbar-track-transparent overflow-y-auto border-0 border-transparent bg-transparent py-1.5 text-transparent caret-white shadow-none ring-0 transition-colors outline-none selection:bg-white/15 placeholder:text-white/[0.40] hover:scrollbar-thumb-white/[0.40] focus:border-0 focus:border-transparent focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0 {transparent
					? 'focus-within:placeholder-white/[0.69]'
					: ''}"
				onkeydown={handleKeyDown}
				onscroll={syncMentionOverlayScroll}
				oninput={(e) => {
					const target = e.currentTarget as HTMLTextAreaElement;
					if (target) {
						target.style.height = 'auto';
						if (target.value) {
							target.style.height = Math.min(target.scrollHeight, 128) + 'px';
						}
					}
					updateMentionState();
				}}
				onfocus={updateMentionState}
				onblur={closeMention}
			/>
		</div>

		<!-- Model Switcher Dropdown -->
		{#if showModelSelector}
			<div class="group/model relative flex h-9 items-center">
				<DropdownMenu.Root
					onOpenChange={(open) => {
						if (!open) modelSearchQuery = '';
					}}
				>
					<DropdownMenu.Trigger
						class="flex cursor-pointer items-center gap-1 px-2 py-1 text-white/[0.40] transition-colors group-focus-within/model:text-white/[0.69] group-hover/model:text-white/[0.69] focus-within:text-white/[0.69] hover:text-white/[0.69] focus:outline-none"
					>
						<img
							src={selectedModel.icon}
							alt={selectedModel.name}
							class="size-5 opacity-40 brightness-0 invert transition-opacity group-focus-within/model:opacity-[0.69] group-hover/model:opacity-[0.69]"
						/>
						<span class="hidden text-sm sm:inline">{selectedModel.name}</span>
						<ChevronDown class="size-4" />
					</DropdownMenu.Trigger>

					{#if onconfigure}
						<!-- Rich dropdown: search + grouped models + Configure -->
						<DropdownMenu.Content
							class="w-80 border border-white/[0.16] p-0 text-white backdrop-blur-[42px] {transparent
								? 'bg-[#232323]/[0.40]'
								: 'bg-[#232323]/[0.85]'}"
						>
							<div class="max-h-72 overflow-y-auto px-1 py-1">
								<Input
									type="search"
									bind:value={modelSearchQuery}
									placeholder="Select a model..."
									class="h-9 rounded-none border-0 border-b border-white/10 bg-transparent px-2.5 text-xs text-white shadow-none focus-visible:border-white/20 focus-visible:ring-0"
									onkeydown={(event) => event.stopPropagation()}
								/>
								{#each modelGroups as group (group.provider)}
									<div class="px-2.5 pt-3 pb-1 text-[11px] font-medium text-white/40">
										{group.label}
									</div>
									{#each group.options as option (`${option.provider}:${option.model}`)}
										<DropdownMenu.Item
											class="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-white/75 focus:bg-white/[0.16] focus:text-white data-highlighted:bg-white/[0.12]"
											onclick={() => (selectedModel = option)}
										>
											<img
												src={option.icon}
												alt={option.name}
												class="size-4 opacity-60 brightness-0 invert"
											/>
											<span class="min-w-0 flex-1 truncate">{option.name}</span>
											{#if selectedModel.provider === option.provider && selectedModel.model === option.model}
												<Check class="size-3.5 text-[#DB8F5E]" />
											{/if}
										</DropdownMenu.Item>
									{/each}
								{/each}
							</div>
							<div class="border-t border-white/10 p-1">
								<DropdownMenu.Item
									class="flex cursor-pointer items-center justify-center gap-2 rounded-md px-2.5 py-2 text-sm text-white/65 focus:bg-white/[0.12] focus:text-white data-highlighted:bg-white/[0.12]"
									onclick={onconfigure}
								>
									<Settings2 class="size-3.5" />
									<span>Configure</span>
								</DropdownMenu.Item>
							</div>
						</DropdownMenu.Content>
					{:else}
						<!-- Simple flat list of models -->
						<DropdownMenu.Content
							class="max-h-60 w-64 overflow-y-auto border border-white/[0.16] text-white backdrop-blur-[42px] {transparent
								? 'bg-[#232323]/[0.40]'
								: 'bg-[#232323]/[0.85]'}"
						>
							{#each llmOptions as option}
								<DropdownMenu.Item
									class="flex cursor-pointer items-center gap-2 focus:bg-white/[0.16] focus:text-white"
									onclick={() => (selectedModel = option)}
								>
									<img src={option.icon} alt={option.name} class="size-4 brightness-0 invert" />
									<span class="truncate">{option.name}</span>
								</DropdownMenu.Item>
							{/each}
						</DropdownMenu.Content>
					{/if}
				</DropdownMenu.Root>
			</div>
		{/if}

		<!-- Send Button -->
		<button
			class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white hover:text-black disabled:opacity-40"
			disabled={isUploading || (!isGenerating && !value.trim() && attachedFiles.length === 0)}
			onclick={handleSendClick}
			aria-label={isUploading
				? 'Uploading attachments'
				: isGenerating
					? 'Stop generating'
					: 'Send Message'}
		>
			{#if isUploading}
				<Loader2 class="size-5 animate-spin" />
			{:else if isGenerating}
				<Square class="size-4" />
			{:else}
				<SendHorizontal class="size-5 -rotate-90" />
			{/if}
		</button>
	</div>
</div>
