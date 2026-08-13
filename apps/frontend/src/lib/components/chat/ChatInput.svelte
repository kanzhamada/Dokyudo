<script lang="ts">
	import { ChevronDown, X, Square, Check, Loader2, Sparkles } from 'lucide-svelte';
	import MxIcon from '$lib/components/icons/MxIcon.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Input } from '$lib/components/ui/input';
	import { toast } from 'svelte-sonner';
	import { mobileHeaderState } from '$lib/state/mobile-header.svelte.js';
	import { documentsStore } from '$lib/state/documents.store.svelte';
	import type { DocumentItem } from '$lib/api/documents';
	import {
		mentionToken,
		parseMentionIds,
		splitMentionSegments,
		formatMentionsForPayload,
		mentionStrippedLength
	} from '$lib/utils/doc-mentions';

	const MAX_DOCUMENT_MENTIONS = 5;
	/** Per-submit cap for file attachments in the chat flow. */
	const MAX_CHAT_ATTACHMENTS = 5;

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
		/** Replace the attach-file button with a Sparkles toggle — used by the
		 * landing search bar (connects to the Documents page search later).
		 * When true, `sparkleActive` holds the toggle state. */
		showSparkleToggle = false,
		/** Active state of the Sparkles toggle (bindable). */
		sparkleActive = $bindable(false),
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

	let editorEl: HTMLDivElement | null = $state(null);
	let fileInput: HTMLInputElement | null = $state(null);
	let modelSearchQuery = $state('');

	// ---- Document mention (`@`) popover state ----
	let mentionOpen = $state(false);
	let mentionQuery = $state('');
	let mentionHighlight = $state(0);
	/** Element refs of the popover items — drives scroll-into-view on keyboard nav. */
	let mentionItemEls: (HTMLButtonElement | undefined)[] = [];

	let currentMentionCount = $derived(parseMentionIds(value).length);
	let isMentionLimitReached = $derived(currentMentionCount >= MAX_DOCUMENT_MENTIONS);

	// Keep the highlighted item visible while navigating with ↑/↓.
	$effect(() => {
		if (!mentionOpen) return;
		mentionItemEls[effectiveHighlight]?.scrollIntoView({ block: 'nearest' });
	});

	let mentionCandidates = $derived.by(() => {
		if (!mentionOpen || isMentionLimitReached) return [];
		const q = mentionQuery.trim().toLowerCase();
		// Exclude documents already referenced by an inline token in the text.
		const mentionedIds = new Set(parseMentionIds(value));
		// Only indexed ("processed") documents are usable as main context.
		return documentsStore.list
			.filter((d) => d.status === 'processed' && !mentionedIds.has(d.id))
			.filter((d) => !q || d.title.toLowerCase().includes(q))
			.sort((a, b) => a.title.localeCompare(b.title))
			.slice(0, 30);
	});

	let effectiveHighlight = $derived(
		mentionCandidates.length === 0 ? 0 : Math.min(mentionHighlight, mentionCandidates.length - 1)
	);

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

	// Focus on mount, and re-focus whenever the caller asks (refocusKey changes)
	$effect(() => {
		refocusKey;
		setTimeout(() => editorEl?.focus(), 0);
	});

	// Sync DOM when `value` changes externally (e.g. cleared `value = ''` after send)
	$effect(() => {
		if (!editorEl) return;
		const currentText = serializeEditor(editorEl);
		if (value !== currentText) {
			renderMarkdownToEditor(value);
		}
	});

	function escapeHtml(str: string): string {
		return str
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function createBadgeNode(title: string, id: string): HTMLElement {
		const span = document.createElement('span');
		span.contentEditable = 'false';
		span.className =
			'inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-xs font-medium text-white/80 select-none align-baseline my-0.5 mx-0.5';
		span.setAttribute('data-mention-title', title);
		span.setAttribute('data-mention-id', id);

		span.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-3 text-white/60 shrink-0"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg><span>${escapeHtml(title)}</span>`;

		return span;
	}

	function serializeEditor(root: HTMLElement): string {
		let str = '';
		for (const node of Array.from(root.childNodes)) {
			if (node.nodeType === Node.TEXT_NODE) {
				str += node.nodeValue || '';
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				const el = node as HTMLElement;
				if (el.tagName === 'BR') {
					str += '\n';
				} else if (el.hasAttribute('data-mention-title')) {
					const title = el.getAttribute('data-mention-title') || '';
					const id = el.getAttribute('data-mention-id') || '';
					str += mentionToken(title, id);
				} else {
					str += serializeEditor(el);
				}
			}
		}
		return str;
	}

	function renderMarkdownToEditor(text: string) {
		if (!editorEl) return;
		editorEl.innerHTML = '';
		if (!text) return;

		const segments = splitMentionSegments(text);
		for (const seg of segments) {
			if (seg.type === 'mention' && seg.title) {
				const badge = createBadgeNode(seg.title, seg.id || '');
				editorEl.appendChild(badge);
			} else if (seg.text) {
				editorEl.appendChild(document.createTextNode(seg.text));
			}
		}
	}

	function syncValue() {
		if (editorEl) {
			value = serializeEditor(editorEl);
		}
	}

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

				const allowedExtensions = ['.pdf', '.txt', '.docx', '.md'];
				const lowerName = file.name.toLowerCase();
				if (!allowedExtensions.some((ext) => lowerName.endsWith(ext))) {
					showError(`File "${file.name}" has an invalid extension. Only PDF, TXT, DOCX and MD are allowed.`);
					continue;
				}

				if (file.size > maxFileSizeBytes) {
					showError(
						`File "${file.name}" exceeds the ${maxFileSizeMB}MB limit for your plan and was rejected.`
					);
					continue;
				}

				if (attachedFiles.length + validFiles.length >= MAX_CHAT_ATTACHMENTS) {
					showError(
						`Cannot attach "${file.name}": Maximum of ${MAX_CHAT_ATTACHMENTS} files per message.`
					);
					continue;
				}

				if (attachedFiles.length + validFiles.length + 1 > maxUploads - baseUploads) {
					showError(`Cannot attach "${file.name}": Exceeds maximum upload limit of ${maxUploads}.`);
					continue;
				}

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
			target.value = '';
		}
	}

	function removeFile(index: number) {
		attachedFiles.splice(index, 1);
	}

	function updateMentionState() {
		const sel = window.getSelection();
		if (!sel || !sel.rangeCount || !editorEl) return;
		const range = sel.getRangeAt(0);

		const preCaretRange = range.cloneRange();
		preCaretRange.selectNodeContents(editorEl);
		preCaretRange.setEnd(range.endContainer, range.endOffset);
		const textBefore = preCaretRange.toString();

		const match = textBefore.match(/(?:^|\s)@([^\s@]*)$/);
		if (match) {
			if (match[1].startsWith('[')) {
				closeMention();
				return;
			}
			mentionQuery = match[1];
			if (!mentionOpen) {
				mentionOpen = true;
				mentionHighlight = 0;
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
		if (isMentionLimitReached) {
			showError(`Maximum limit of ${MAX_DOCUMENT_MENTIONS} document mentions per turn reached.`);
			closeMention();
			return;
		}

		const sel = window.getSelection();
		if (!sel || !sel.rangeCount || !editorEl) return;

		const range = sel.getRangeAt(0);
		let textNode = range.startContainer;

		if (textNode.nodeType !== Node.TEXT_NODE) {
			textNode = document.createTextNode('');
			editorEl.appendChild(textNode);
			range.selectNodeContents(textNode);
		}

		const text = textNode.nodeValue || '';
		const caretOffset = range.startOffset;
		const textBefore = text.slice(0, caretOffset);
		const match = textBefore.match(/(?:^|\s)@([^\s@]*)$/);

		if (match) {
			const matchStart = caretOffset - match[1].length - 1;
			const textBeforeMatch = text.slice(0, matchStart);
			const textAfterCaret = text.slice(caretOffset);

			const badge = createBadgeNode(doc.title, doc.id);
			const spaceNode = document.createTextNode('\u00A0');

			const parent = textNode.parentNode;
			if (parent) {
				const beforeNode = document.createTextNode(textBeforeMatch);
				const afterNode = document.createTextNode(textAfterCaret);

				parent.insertBefore(beforeNode, textNode);
				parent.insertBefore(badge, textNode);
				parent.insertBefore(spaceNode, textNode);
				parent.insertBefore(afterNode, textNode);
				parent.removeChild(textNode);

				const newRange = document.createRange();
				newRange.setStartAfter(spaceNode);
				newRange.collapse(true);
				sel.removeAllRanges();
				sel.addRange(newRange);
			}
		}

		closeMention();
		syncValue();
		editorEl.focus();
	}

	function handleSendClick() {
		if (isGenerating) {
			onstop();
		} else {
			syncValue();
			value = formatMentionsForPayload(value);
			onsend();
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (mentionOpen) {
			const count = Math.max(1, mentionCandidates.length);
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				mentionHighlight = (effectiveHighlight + 1) % count;
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				mentionHighlight = (effectiveHighlight - 1 + count) % count;
				return;
			}
			if (e.key === 'Enter') {
				e.preventDefault();
				const doc = mentionCandidates[effectiveHighlight];
				if (doc) {
					selectMention(doc);
				} else if (documentsStore.loading) {
					return;
				} else {
					closeMention();
				}
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
			syncValue();
			value = formatMentionsForPayload(value);
			onsend();
		}
	}

	function handlePaste(e: ClipboardEvent) {
		e.preventDefault();
		const text = e.clipboardData?.getData('text/plain') || '';
		const sel = window.getSelection();
		if (!sel || !sel.rangeCount) return;
		const range = sel.getRangeAt(0);
		range.deleteContents();
		const textNode = document.createTextNode(text);
		range.insertNode(textNode);
		range.setStartAfter(textNode);
		range.collapse(true);
		sel.removeAllRanges();
		sel.addRange(range);
		syncValue();
		updateMentionState();
	}
</script>

<div class="relative w-full">
	<!-- Document mention popover (@ trigger) — floats above capsule -->
	{#if mentionOpen}
		<div
			class="absolute right-0 bottom-full left-0 z-50 mb-2 overflow-hidden rounded-2xl border border-white/[0.16] text-white shadow-2xl backdrop-blur-[42px] {transparent
				? 'bg-[#232323]/[0.40]'
				: 'bg-[#232323]/[0.85]'}"
			role="listbox"
			aria-label="Documents"
			tabindex="-1"
			onmousedown={(e) => e.preventDefault()}
		>
			<div class="max-h-64 overflow-y-auto p-1.5">
				{#if isMentionLimitReached}
					<div class="flex items-center gap-2 px-3 py-2.5 text-sm text-white/60">
						<MxIcon name="danger-triangle-outline" class="size-4 shrink-0 text-white/40" />
						<span>Maximum limit of 5 document mentions reached.</span>
					</div>
				{:else if documentsStore.loading}
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
							aria-selected={index === effectiveHighlight}
							class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-white/75 transition-colors hover:bg-white/[0.12] hover:text-white {index ===
							effectiveHighlight
								? 'bg-white/[0.12] text-white'
								: ''}"
							onmouseenter={() => (mentionHighlight = index)}
							onclick={() => selectMention(doc)}
						>
							<MxIcon name="document-outline" class="size-4 shrink-0 text-white/60" />
							<span class="min-w-0 flex-1 truncate">{doc.title}</span>
						</button>
					{/each}
				{/if}
			</div>
		</div>
	{/if}

	<!-- Main Input Capsule -->
	<div
		class="group relative flex w-full flex-col gap-1 rounded-[24px] border border-white/[0.16] px-4 py-2 backdrop-blur-[42px] transition-all {transparent
			? 'bg-[#232323]/[0.40]'
			: 'bg-[#232323]/[0.85] shadow-2xl'}"
	>
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
			<!-- Attach Document / Sparkles Toggle -->
			<div class="relative flex h-9 items-center">
				{#if showSparkleToggle}
					<!-- Sparkles toggle (landing search bar — connects to the
					     Documents page search later). State-only for now. -->
					<Tooltip.Provider delayDuration={100}>
						<Tooltip.Root>
							<Tooltip.Trigger
								class="flex cursor-pointer items-center transition-colors focus:outline-none {sparkleActive
									? 'text-[#DB8F5E]'
									: 'text-white/[0.40] hover:text-white/[0.69]'}"
								aria-label={sparkleActive ? 'AI search active' : 'Enable AI search'}
								aria-pressed={sparkleActive}
								onclick={() => (sparkleActive = !sparkleActive)}
							>
								<Sparkles class="size-5" />
							</Tooltip.Trigger>
							<Tooltip.Content
								class="border-white/[0.16] bg-[#232323] text-white"
								arrowClasses="bg-[#232323] border-white/[0.16] border-b border-r"
							>
								<p>{sparkleActive ? 'AI search active' : 'Enable AI search'}</p>
							</Tooltip.Content>
						</Tooltip.Root>
					</Tooltip.Provider>
				{:else}
					<Tooltip.Provider delayDuration={100}>
						<Tooltip.Root>
							<Tooltip.Trigger
								class="flex cursor-pointer items-center text-white/[0.40] transition-colors focus-within:text-white/[0.69] hover:text-white/[0.69]"
								aria-label="Attach Document"
								onclick={triggerFileInput}
							>
								<MxIcon name="attach-circle-outline" class="size-5" />
							</Tooltip.Trigger>
							<Tooltip.Content
								class="flex flex-col gap-1 border-white/[0.16] bg-[#232323] text-white"
								arrowClasses="bg-[#232323] border-white/[0.16] border-b border-r"
							>
								<p>Attach Document (PDF, DOCX, MD, and TXT)</p>
								<p class="text-xs text-white/[0.69]">
									{maxUploads - currentUploadCount} uploads remaining • Max {maxFileSizeMB}MB/file
								</p>
							</Tooltip.Content>
						</Tooltip.Root>
					</Tooltip.Provider>
				{/if}
			</div>
			<Input
				type="file"
				bind:ref={fileInput}
				id="file-upload"
				accept=".pdf,.txt,.docx,.md"
				class="hidden"
				multiple
				onchange={handleFileChange}
			/>

			<!-- Input Text Field: Rich contenteditable editor with native atomic mention nodes -->
			<div class="relative min-w-0 flex-1">
				<div
					bind:this={editorEl}
					contenteditable="true"
					role="textbox"
					tabindex="0"
					aria-multiline="true"
					aria-placeholder={placeholder}
					data-placeholder={placeholder}
					class="mention-editor max-h-32 min-h-[36px] w-full overflow-y-auto bg-transparent py-1.5 text-base break-words whitespace-pre-wrap text-white caret-white outline-none selection:bg-white/15 md:text-sm"
					oninput={() => {
						syncValue();
						updateMentionState();
					}}
					onkeydown={handleKeyDown}
					onpaste={handlePaste}
					onfocus={updateMentionState}
					onblur={closeMention}
				></div>
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
										<MxIcon name="settings-settings-outline" class="size-3.5" />
										<span>Configure</span>
									</DropdownMenu.Item>
								</div>
							</DropdownMenu.Content>
						{:else}
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
				class="group/send flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white hover:text-black disabled:opacity-40"
				disabled={isUploading ||
					(!isGenerating &&
						mentionStrippedLength(value.trim()) === 0 &&
						attachedFiles.length === 0)}
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
					<span class="group-hover/send:hidden"><MxIcon name="send1-outline" class="size-5 -rotate-45" /></span>
						<span class="hidden group-hover/send:block"><MxIcon name="send1-bold" class="size-5 -rotate-45" /></span>
				{/if}
			</button>
		</div>
	</div>
</div>

<style>
	.mention-editor:empty::before {
		content: attr(data-placeholder);
		color: rgba(255, 255, 255, 0.4);
		pointer-events: none;
		display: block;
	}
</style>
