<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { slide, scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		ChevronDown,
		ChevronLeft,
		ChevronRight,
		X,
		Sparkles,
		Copy,
		Check,
		ThumbsUp,
		ThumbsDown,
		GitBranch,
		Volume2,
		RotateCw,
		Square,
		Plus
	} from 'lucide-svelte';

	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Dialog from '$lib/components/ui/dialog';
	import MobileHeader from '$lib/components/app/MobileHeader.svelte';
	import EditTitleDialog from '$lib/components/app/EditTitleDialog.svelte';
	import ConfirmDeleteDialog from '$lib/components/app/ConfirmDeleteDialog.svelte';
	import ShareConversationDialog from '$lib/components/app/ShareConversationDialog.svelte';
	import { useSidebar } from '$lib/components/ui/sidebar';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Resizable from '$lib/components/ui/resizable';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { toast } from 'svelte-sonner';
	import { mobileHeaderState } from '$lib/state/mobile-header.svelte.js';
	import { getMeUsageCached } from '$lib/state/me-cache.store.svelte';
	import { seo } from '$lib/seo';
	import { conversationCache } from '$lib/state/conversation-cache.store.svelte';
	import { getKeys } from '$lib/api/keys';
	import { uploadFilesAsDocuments, type ChatAttachment } from '$lib/api/documents';
	import { documentsStore } from '$lib/state/documents.store.svelte';
	import { mentionStrippedLength, splitMentionSegments } from '$lib/utils/doc-mentions';
	import {
		branchConversation,
		deleteConversation,
		deleteTurn,
		getConversation,
		updateConversation,
		updateTurnFeedback
	} from '$lib/api/rag';
	import { TIER_LIMITS, type TierType } from '$lib/constants/tiers.constant';
	import { PUBLIC_API_URL } from '$env/static/public';
	import { dokyudoFetch } from '$lib/apiClient';
	import { apiRequest } from '$lib/api/client';
	import { conversationsStore } from '$lib/state/conversations.store.svelte';
	import { accountPanel, openAccountPanel } from '$lib/state/account-panel.store.svelte';
	import PdfPreviewPanel from '$lib/components/app/PdfPreviewPanel.svelte';
	import { mergeConversationReferences, type DocReference } from '$lib/utils/doc-references';
	import type { TurnAlternative, GetConversationResponse } from '$lib/types/rag.types';
	import CodeBlockPreview from '$lib/components/chat/CodeBlockPreview.svelte';
	import CitationTooltip from '$lib/components/chat/CitationTooltip.svelte';
	import { mount, unmount, untrack } from 'svelte';
	import TurnStatusBadge from '$lib/components/chat/TurnStatusBadge.svelte';
	import SourceReferences from '$lib/components/chat/SourceReferences.svelte';
	import AttachmentCards from '$lib/components/chat/AttachmentCards.svelte';
	import ChatInput from '$lib/components/chat/ChatInput.svelte';
	import MxIcon from '$lib/components/icons/MxIcon.svelte';
	import { renderMarkdown } from '$lib/utils/markdown';

	import claudeIcon from '$lib/assets/llm/claude.svg';
	import cohereIcon from '$lib/assets/llm/cohere.svg';
	import geminiIcon from '$lib/assets/llm/gemini.svg';
	import groqIcon from '$lib/assets/llm/groq.svg';
	import metaIcon from '$lib/assets/llm/meta.svg';
	import mistralIcon from '$lib/assets/llm/mistral.svg';
	import openaiIcon from '$lib/assets/llm/openai.svg';
	import openrouterIcon from '$lib/assets/llm/openrouter.svg';
	import freeIcon from '$lib/assets/llm/free.svg';

	interface LlmOption {
		name: string;
		provider: string;
		model: string;
		icon: string;
	}

	type ByokProvider = 'gemini' | 'mistral' | 'openrouter';

	interface ChatMessage {
		id: string;
		role: 'user' | 'assistant';
		content: string;
		timestamp: string;
		modelName?: string;
		/** Files attached to this message. `documentId` is set once uploaded —
		 * it scopes RAG retrieval and is reused by edit/retry of this turn. */
		attachments?: { name: string; size?: number; documentId?: string }[];
		/** Attachment document ids as persisted on the server turn — survives
		 * reloads, lets edit/retry reuse the same RAG scoping. */
		attachmentDocumentIds?: string[];
		references?: DocReference[];
		isStreaming?: boolean;
		isCancelled?: boolean;
		isRejection?: boolean;
		/** Server turn id — needed to re-generate this turn in place (edit mode). */
		turnId?: string;
		/** Status from the server: awaiting_indexing | processing | complete | stopped | failed | blocked. */
		status?: 'awaiting_indexing' | 'processing' | 'complete' | 'stopped' | 'failed' | 'blocked';
		/** User feedback on the answer: good | bad | null (not rated / cleared). */
		feedback?: 'good' | 'bad' | null;
		/** Set on the boundary turn of a branched conversation. */
		branchedFromTurnId?: string | null;
		/** Retry variants of this turn (the canonical answer is separate, see variantIndex). */
		variants?: ChatVariant[];
		/** 0 = canonical answer (content), k = variants[k-1]. Defaults to 0. */
		variantIndex?: number;
		/** True while a retry variant is streaming into this message. */
		isRetrying?: boolean;
	}

	/** A retried answer of a turn — TurnAlternative plus frontend-only render state. */
	interface ChatVariant extends TurnAlternative {
		/** Mapped doc references for rendering (same shape as ChatMessage.references). */
		references?: DocReference[];
		/** True while this variant is being streamed in. */
		isStreaming?: boolean;
	}

	/** The variant currently displayed on a message, or null when showing the canonical answer. */
	function activeVariantOf(msg: ChatMessage): ChatVariant | null {
		const idx = msg.variantIndex ?? 0;
		if (idx > 0 && msg.variants && msg.variants[idx - 1]) return msg.variants[idx - 1];
		return null;
	}

	function displayedContentOf(msg: ChatMessage): string {
		return activeVariantOf(msg)?.answer ?? msg.content;
	}

	function displayedRefsOf(msg: ChatMessage): DocReference[] {
		const variant = activeVariantOf(msg);
		if (variant) return variant.references ?? [];
		return msg.references ?? [];
	}

	/** Terminal status of the answer currently displayed (variant or canonical). */
	function displayedStatusOf(msg: ChatMessage): ChatMessage['status'] {
		const variant = activeVariantOf(msg);
		if (variant) return variant.status;
		return msg.status;
	}

	/** True when the displayed answer (variant or canonical) was cancelled/stopped. */
	function displayedCancelledOf(msg: ChatMessage): boolean {
		const variant = activeVariantOf(msg);
		if (variant) return variant.status === 'stopped';
		return msg.isCancelled === true;
	}

	const PROVIDER_ICONS: Record<string, string> = {
		gemini: geminiIcon,
		mistral: mistralIcon,
		openrouter: openrouterIcon,
		openai: openaiIcon,
		claude: claudeIcon,
		cohere: cohereIcon,
		groq: groqIcon,
		meta: metaIcon
	};

	const INITIAL_LLM_OPTIONS: LlmOption[] = [
		{ name: 'Free Auto', provider: 'auto', model: 'auto', icon: freeIcon }
	];

	// UI & Transition State
	let chatContainer: HTMLDivElement | null = $state(null);
	let inputValue = $state('');
	let llmOptions: LlmOption[] = $state(INITIAL_LLM_OPTIONS);
	let selectedModel: LlmOption = $state(INITIAL_LLM_OPTIONS[0]);
	let attachedFiles: File[] = $state([]);
	let copiedMessageId: string | null = $state(null);
	let isGenerating = $state(false);
	let isUploadingAttachments = $state(false);
	let editingMessageId = $state<string | null>(null);
	let editingMessageValue = $state('');
	let editingTextInput: HTMLTextAreaElement | null = $state(null);
	let activeAbortController: AbortController | null = null;
	let cancelActiveStream: (() => void) | null = null;
	let activeStreamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
	/** Write-target id of the in-flight stream (turn id, or variant id in
	 * retry mode) — used by the explicit stop endpoint. */
	let activeTurnWriteTargetId: string | null = null;
	const sidebar = useSidebar();
	let isTitleEditDialogOpen = $state(false);
	let titleDraft = $state('');
	let isTitleSaving = $state(false);
	let isDeleteConversationDialogOpen = $state(false);
	let isConversationDeleting = $state(false);
	let isShareDialogOpen = $state(false);
	let isDeleteResponseDialogOpen = $state(false);
	let isResponseDeleting = $state(false);
	let targetDeleteMessageIndex = $state<number | null>(null);
	let isTitleMenuOpen = $state(false);
	let titleMenuPos = $state<{ x: number; y: number }>({ x: 0, y: 0 });

	let activeResponseMenuMsgIndex = $state<number | null>(null);
	let responseMenuPos = $state<{ x: number; y: number }>({ x: 0, y: 0 });
	let speakingMessageId = $state<string | null>(null);
	/** Cached speech voices — populated via the voiceschanged event (async load). */
	let speechVoices: SpeechSynthesisVoice[] = $state([]);

	function triggerHaptic(duration = 20) {
		if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
			try {
				navigator.vibrate(duration);
			} catch {
				// Unsupported
			}
		}
	}

	function openTitleMenu(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		triggerHaptic(15);
		const rect = (e.currentTarget as HTMLElement)?.getBoundingClientRect();
		if (rect) {
			titleMenuPos = {
				x: rect.left + rect.width / 2,
				y: rect.bottom
			};
		} else {
			titleMenuPos = { x: e.clientX, y: e.clientY };
		}
		isTitleMenuOpen = !isTitleMenuOpen;
		isMobileReferencesOpen = false;
		closeResponseMenu();
	}

	function openResponseMenu(e: MouseEvent, msgIndex: number) {
		e.preventDefault();
		e.stopPropagation();
		triggerHaptic(15);
		const rect = (e.currentTarget as HTMLElement)?.getBoundingClientRect();
		if (rect) {
			responseMenuPos = {
				x: rect.left,
				y: rect.bottom
			};
		} else {
			responseMenuPos = { x: e.clientX, y: e.clientY };
		}
		activeResponseMenuMsgIndex = msgIndex;
		isTitleMenuOpen = false;
	}

	function closeResponseMenu() {
		activeResponseMenuMsgIndex = null;
	}
	let isMobileReferencesOpen = $state(false);
	let isMobileTitleActionsOpen = $state(false);
	let pulseCheckpointId = $state<string | null>(null);
	let pulseCheckpointTimeout: ReturnType<typeof setTimeout> | null = null;
	let checkpointVisibilityTimeout: ReturnType<typeof setTimeout> | null = null;

	let conversationReferences = $derived.by(() =>
		mergeConversationReferences(
			messages
				.filter((message) => message.role === 'assistant')
				.map((message) => message.references)
		)
	);

	// Citation PDF preview
	let citationPreview = $state<{ src: string; name: string; pages: number[] } | null>(null);
	let citationDocId = $state<string | null>(null);
	let preservedChatScrollTop = $state(0);

	// LRU cache for presigned document URLs — max 4 docs, evicts oldest on overflow.
	// Map preserves insertion order, so first key = Least Recently Used.
	const MAX_CACHED_DOCS = 4;
	const docUrlCache = new Map<string, string>();

	function cacheGet(documentId: string): string | null {
		const url = docUrlCache.get(documentId);
		if (!url) return null;
		// Move to end (mark as most recently used)
		docUrlCache.delete(documentId);
		docUrlCache.set(documentId, url);
		return url;
	}

	function cacheSet(documentId: string, url: string): void {
		if (docUrlCache.has(documentId)) {
			docUrlCache.delete(documentId);
		} else if (docUrlCache.size >= MAX_CACHED_DOCS) {
			docUrlCache.delete(docUrlCache.keys().next().value!);
		}
		docUrlCache.set(documentId, url);
	}

	async function openCitationPreview(documentId: string, name: string, pages: number[]) {
		if (!documentId) return;
		preservedChatScrollTop = chatContainer?.scrollTop ?? preservedChatScrollTop;
		// Same document already open — just jump to the page
		if (citationDocId === documentId && citationPreview) {
			citationPreview = { ...citationPreview, pages };
			return;
		}
		// Check cache first, fetch only on miss
		let url = cacheGet(documentId);
		if (!url) {
			const res = await apiRequest<{ url: string; expiresIn: number }>(
				`/api/documents/${documentId}/preview`
			);
			if (!res.ok) return;
			url = res.data.url;
			cacheSet(documentId, url);
		}
		citationDocId = documentId;
		citationPreview = { src: url, name, pages };
		await tick();
		if (chatContainer) chatContainer.scrollTop = preservedChatScrollTop;
	}

	async function closeCitationPreview() {
		preservedChatScrollTop = chatContainer?.scrollTop ?? preservedChatScrollTop;
		citationPreview = null;
		await tick();
		if (chatContainer) chatContainer.scrollTop = preservedChatScrollTop;
	}

	const THINKING_STATUS_MESSAGES = [
		'Chudmaxxing...',
		'Aura-farming...',
		'Redeeming...',
		'Clodding...',
		'Tokenmaxxing...',
		'Slopping...',
		'Clanking...',
		'Ignoring GPL...',
		'Increasing ram prices...',
		'Hallucinating...',
		'Selling your data...',
		'Outsourcing to Mossad...',
		'Gemming it up...',
		'Absolute coaling...',
		'Truth-nuking...',
		'Fakecelling...',
		'Truecelling...',
		'Mogging...',
		'Rizzing...',
		'Dumbing it down...',
		'Enshittifying...',
		'Going full retard...',
		'Summoning Cheesy Michael...',
		'Degenerating...',
		'Running "sudo rm -rf --no-preserve-root /"...',
		'Virtual insanitying...',
		'Bomboclating...',
		'Gambling...',
		'Ending it all...',
		'Rebooting...',
		'Unicycling...',
		'Horsing around...',
		'Calling Mahoraga...',
		'Calling Kevin...',
		'Calling Saul...',
		'Nuking SF...',
		'Spellcasting...',
		'Hexing...',
		'Prompt-injecting...',
		'Installing Windows...',
		'Ultrathinking...',
		'Nuking prod...',
		'Tokenmining...',
		'Questioning...',
		'Chinesing...',
		'Selling the wife and kids...',
		'Increasing shareholder value...',
		'Winging it...',
		'Cooking...'
	];

	// Shown first (in order) while an attachment turn is waiting for the STB
	// worker to finish ingesting its documents, then the general pool takes
	// over randomly.
	const ATTACHMENT_WAITING_STATUSES = [
		'Waiting for documents to be indexed...',
		'Indexing your attachments...',
		'Parsing your files...',
		'Preparing document context...'
	];

	let currentThinkingStatus = $state(THINKING_STATUS_MESSAGES[0]);
	let thinkingTimer: ReturnType<typeof setInterval> | null = null;

	/**
	 * Starts the rotating thinking status. `priorityStatuses` (if any) are
	 * shown once each, in order, before the general pool takes over randomly.
	 */
	function startThinkingTimer(priorityStatuses: string[] = []) {
		if (thinkingTimer) clearInterval(thinkingTimer);
		const priorityQueue = [...priorityStatuses];
		const getRandomStatus = () => {
			if (priorityQueue.length > 0) return priorityQueue.shift()!;
			return THINKING_STATUS_MESSAGES[Math.floor(Math.random() * THINKING_STATUS_MESSAGES.length)];
		};
		currentThinkingStatus = getRandomStatus();
		thinkingTimer = setInterval(() => {
			currentThinkingStatus = getRandomStatus();
		}, 1400);
	}

	function stopThinkingTimer() {
		if (thinkingTimer) {
			clearInterval(thinkingTimer);
			thinkingTimer = null;
		}
	}

	onDestroy(() => {
		// The SSE connection is deliberately NOT cancelled here: on SvelteKit
		// navigation the stream keeps running and completes the turn normally;
		// on a real page unload the browser drops the connection and the server
		// hands the turn to the background sweep. Either way the answer is not
		// lost when the user leaves the page.
		stopSpeaking();
		stopThinkingTimer();
		if (pulseCheckpointTimeout) clearTimeout(pulseCheckpointTimeout);
		if (checkpointVisibilityTimeout) clearTimeout(checkpointVisibilityTimeout);
		// Unmount citation tooltips mounted inside the citation chips
		citationTooltipInstances.forEach((instance) => instance.unmount());
		citationTooltipInstances = [];
	});

	// Instances of CitationTooltip mounted inside citation chips, keyed by their chip element.

	// Instances of CitationTooltip mounted inside citation chips, keyed by their chip element.
	let citationTooltipInstances: { chip: HTMLElement; unmount: () => void }[] = [];

	// Auto-mount interactive Code & Mermaid Preview components and inline citation tooltips.
	// Re-runs whenever messages change, so tooltips are attached as citation chips stream in.
	$effect(() => {
		const lastAssistantContent = lastDisplayedContent;
		if (!chatContainer) return;

		// Prune tooltip instances whose chip was replaced by a re-render of the markdown.
		citationTooltipInstances = citationTooltipInstances.filter((instance) => {
			if (!document.contains(instance.chip)) {
				instance.unmount();
				return false;
			}
			return true;
		});

		if (!lastAssistantContent) return;

		setTimeout(() => {
			if (!chatContainer) return;
			const blockElements = chatContainer.querySelectorAll<HTMLElement>(
				'.code-block-embed:not([data-mounted])'
			);
			blockElements.forEach((el) => {
				const rawCode = el.getAttribute('data-code');
				const lang = el.getAttribute('data-lang') || '';
				if (rawCode) {
					const code = decodeURIComponent(rawCode);
					el.setAttribute('data-mounted', 'true');
					mount(CodeBlockPreview, {
						target: el,
						props: { code, language: lang }
					});
				}
			});

			const citationChips = chatContainer.querySelectorAll<HTMLElement>(
				'[data-doc-id]:not([data-tooltip-mounted])'
			);
			citationChips.forEach((chip) => {
				chip.setAttribute('data-tooltip-mounted', 'true');
				const instance = mount(CitationTooltip, {
					// Mount inside the chip: the chip is `relative`, so the tooltip's
					// invisible overlay trigger covers exactly the chip area. Mounting
					// on document.body would make the overlay fill the whole viewport.
					target: chip,
					props: { trigger: chip }
				});
				citationTooltipInstances.push({ chip, unmount: () => unmount(instance) });
			});
		}, 30);
	});

	// Conversation metadata
	let chatId = $derived(page.params.id || 'chat-default');
	let conversationTitle = $state('New Conversation');
	let branchOfTitle = $state<string | null>(null);
	let branchOfId = $state<string | null>(null);
	let isPinned = $state(false);
	let isTitleLoading = $state(false);

	// Sync conversationTitle reactively if updated from sidebar via conversationsStore
	$effect(() => {
		const currentStoreItem = conversationsStore.list.find((c) => c.id === chatId);
		if (
			currentStoreItem &&
			currentStoreItem.title &&
			currentStoreItem.title !== conversationTitle
		) {
			console.log(
				'[Chat Detail] Syncing header title from conversationsStore:',
				currentStoreItem.title
			);
			conversationTitle = currentStoreItem.title;
		}
	});

	// Conversation Messages
	let messages: ChatMessage[] = $state([]);

	// The last assistant message and the answer it currently displays (canonical
	// or browsed retry variant) — the tooltip/codeblock mount effect reacts to
	// variant browsing so chips of a newly displayed variant get mounted too.
	let lastAssistantMsg = $derived(
		[...messages].reverse().find((m) => m.role === 'assistant') ?? null
	);
	let lastDisplayedContent = $derived(lastAssistantMsg ? displayedContentOf(lastAssistantMsg) : '');
	let conversationCheckpoints = $derived(messages.filter((message) => message.role === 'user'));
	let conversationRequestId = 0;

	// Track the last user message id for edit button visibility
	let lastUserMsgId = $derived([...messages].reverse().find((m) => m.role === 'user')?.id ?? null);
	let activeCheckpointId = $state<string | null>(null);
	let currentCheckpointId = $derived(activeCheckpointId ?? lastUserMsgId);

	// Share is only allowed once the conversation has at least one answer —
	// success or failure — and no turn is being processed (including the
	// attachment upload and awaiting-indexing phases of an attachment turn).
	const isShareDisabled = $derived(
		isGenerating ||
			isUploadingAttachments ||
			!messages.some((m) => m.role === 'assistant') ||
			messages.some(
				(m) =>
					m.role === 'assistant' &&
					(m.isStreaming ||
						m.isRetrying ||
						m.status === 'processing' ||
						m.status === 'awaiting_indexing')
			)
	);

	// Global Usage Constraints (Dynamic based on Tenant Tier)
	let baseUploads = $state(0);
	let maxUploads = $state(10);
	let baseStorage = $state(0);
	let maxStorage = $state(100 * 1024 * 1024);
	let maxFileSizeBytes = $state(10 * 1024 * 1024);
	let searchesCount = $state(0);
	let maxSearches = $state(100);
	let qaCount = $state(0);
	let maxQa = $state(50);

	function applyConversationData(data: GetConversationResponse) {
		if (data.title) conversationTitle = data.title;
		branchOfTitle = data.branchOf?.title ?? null;
		branchOfId = data.branchOf?.id ?? null;
		isPinned = data.isPinned ?? false;
		if (data.turns && data.turns.length > 0) {
			const historyMsgs: ChatMessage[] = [];
			for (const turn of data.turns) {
				historyMsgs.push({
					id: `${turn.id}-user`,
					role: 'user',
					content: turn.question,
					turnId: turn.id,
					branchedFromTurnId: turn.branchedFromTurnId ?? null,
					// Persisted on the server turn — lets edit/retry reuse
					// the same RAG scoping after a reload.
					attachmentDocumentIds: turn.attachmentDocumentIds ?? undefined,
					// Display metadata (titles) returned by the server — the
					// attachment chips survive reloads with real document titles.
					attachments: turn.attachmentDocuments?.map((a) => ({
						name: a.title,
						documentId: a.documentId
					})),
					timestamp: new Date(turn.createdAt).toLocaleTimeString([], {
						hour: '2-digit',
						minute: '2-digit'
					})
				});
				historyMsgs.push({
					id: `${turn.id}-asst`,
					role: 'assistant',
					turnId: turn.id,
					branchedFromTurnId: turn.branchedFromTurnId ?? null,
					modelName: turn.modelUsed || undefined,
					content: turn.answer,
					status: turn.status ?? 'complete',
					feedback: turn.feedback ?? null,
					timestamp: new Date(turn.createdAt).toLocaleTimeString([], {
						hour: '2-digit',
						minute: '2-digit'
					}),
					references: turn.contextReferences?.map((r: any) => ({
						id: r.documentId,
						index: r.index || 1,
						name: r.title || r.documentId,
						pages: r.pages,
						snippet: r.snippet ?? undefined
					})),
					variants: (turn.alternatives ?? []).map((alt) => ({
						...alt,
						references: alt.contextReferences?.map((r: any) => ({
							id: r.documentId,
							index: r.index || 1,
							name: r.title || r.documentId,
							pages: r.pages,
							snippet: r.snippet ?? undefined
						})),
						isStreaming: false
					})),
					variantIndex: 0,
					isStreaming: false
				});
			}
			messages = historyMsgs;
		}
	}

	async function loadConversation(id: string) {
		const requestId = ++conversationRequestId;
		cancelActiveStream?.();
		stopSpeaking();
		messages = [];
		conversationTitle = 'New Conversation';
		branchOfTitle = null;
		branchOfId = null;
		isPinned = false;
		inputValue = '';
		attachedFiles = [];

		const stateObj =
			((page as any)?.state as any) || (history.state as any)?.usr || (history.state as any);

		// If navigating with an initial question (new room submission), skip fetching DB history
		// to avoid a 404 HTTP request before the conversation record is created by SSE.
		if (requestId === conversationRequestId && stateObj?.initialQuestion) {
			console.log(`[Chat Detail] Initializing new conversation for ID: ${id}`);
			isTitleLoading = true;
			const initialQ = stateObj.initialQuestion as string;
			const initialModel = (stateObj.selectedModel as LlmOption) || selectedModel;
			// Files were uploaded on /app/chat before navigation — their
			// document ids travel through navigation state. `@`-mention tokens
			// live inside the question text and are parsed on send.
			const stateAttachments =
				(stateObj?.attachmentDocuments as ChatAttachment[] | undefined) ?? undefined;
			if (stateObj.selectedModel) selectedModel = stateObj.selectedModel as LlmOption;
			streamChatTurn(initialQ, initialModel, { attachments: stateAttachments });
			scrollToBottom();
			return;
		}

		// Cache-first: render instan dari LRU cache, lalu revalidasi di background (SWR).
		const cached = conversationCache.get(id);
		if (cached && !conversationCache.isProcessing(id)) {
			applyConversationData(cached);
			scrollToBottom();
		}

		try {
			console.log(`[Chat Detail] Fetching conversation history for ID: ${id}`);
			const convRes = await conversationCache.refresh(id);
			if (requestId !== conversationRequestId) return;
			if (convRes.ok && convRes.data && !convRes.notModified) {
				applyConversationData(convRes.data);
			} else if (!convRes.ok && convRes.error?.code === 'NOT_FOUND') {
				console.log(
					`[Chat Detail] Conversation ID ${id} not found in DB. Redirecting to /app/chat`
				);
				showError('Conversation not found');
				await goto('/app/chat');
				return;
			}
		} catch (err) {
			if (requestId === conversationRequestId)
				console.error('[Chat Detail] Failed to load conversation:', err);
			return;
		}

		scrollToBottom();
	}

	$effect(() => {
		const currentId = chatId;
		untrack(() => {
			loadConversation(currentId);
		});
	});

	function isByokProvider(provider: string): provider is ByokProvider {
		return provider === 'gemini' || provider === 'mistral' || provider === 'openrouter';
	}

	async function loadLlmOptions() {
		try {
			const keysRes = await getKeys();
			if (!keysRes.ok) return;

			const dynamicOptions: LlmOption[] = [...INITIAL_LLM_OPTIONS];

			for (const item of keysRes.data.data ?? []) {
				const provider = item.provider.toLowerCase();
				if (!isByokProvider(provider)) continue;

				const icon = PROVIDER_ICONS[provider] || geminiIcon;
				for (const model of item.models ?? []) {
					dynamicOptions.push({
						name: model,
						provider,
						model,
						icon
					});
				}
			}

			const selectedKey = `${selectedModel.provider}:${selectedModel.model}`;
			llmOptions = dynamicOptions;
			selectedModel =
				dynamicOptions.find((option) => `${option.provider}:${option.model}` === selectedKey) ??
				dynamicOptions[0];
		} catch (err) {
			console.error('[Chat Detail] Failed to fetch BYOK keys:', err);
		}
	}

	function openConfigureDialog() {
		openAccountPanel('byok');
	}

	$effect(() => {
		if (accountPanel.byokSavedAt > 0) void loadLlmOptions();
	});

	function openTitleEditDialog() {
		titleDraft = conversationTitle === 'New Conversation' ? '' : conversationTitle;
		isTitleEditDialogOpen = true;
	}

	async function saveConversationTitle(nextTitle: string) {
		const trimmed = nextTitle.trim();
		if (!trimmed || isTitleSaving) return;

		isTitleSaving = true;
		const oldTitle = conversationTitle;

		// Realtime illusion: Optimistically update local title & store for instant response
		conversationTitle = trimmed;
		conversationsStore.addOrUpdate(chatId, trimmed);
		isTitleEditDialogOpen = false;

		try {
			const result = await updateConversation(chatId, { title: trimmed });
			if (result.ok) {
				conversationCache.invalidate(chatId);
				showSuccess('Conversation title updated', '');
			} else {
				console.error('[Chat Detail] Update title failed, reverting:', result.error);
				conversationTitle = oldTitle;
				conversationsStore.addOrUpdate(chatId, oldTitle);
				toast.error(result.error.message);
			}
		} catch (err) {
			console.error('[Chat Detail] Failed to update conversation title:', err);
			conversationTitle = oldTitle;
			conversationsStore.addOrUpdate(chatId, oldTitle);
			toast.error('Failed to update conversation title');
		} finally {
			isTitleSaving = false;
		}
	}

	async function togglePinConversation() {
		const newPinnedState = !isPinned;
		const targetChatId = chatId;
		console.log('[Chat Detail] Toggling pin:', { id: targetChatId, isPinned: newPinnedState });

		if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}

		// Optimistically update local state & store so sidebar and header update instantly
		isPinned = newPinnedState;
		conversationsStore.addOrUpdate(targetChatId, conversationTitle, newPinnedState);
		isTitleMenuOpen = false;

		try {
			const result = await updateConversation(targetChatId, { isPinned: newPinnedState });
			if (result.ok) {
				conversationCache.invalidate(targetChatId);
				console.log('[Chat Detail] Pin toggle success:', result.data);
				showSuccess(newPinnedState ? 'Conversation pinned' : 'Conversation unpinned', '');
			} else {
				console.error('[Chat Detail] Pin toggle failed, reverting:', result.error);
				isPinned = !newPinnedState;
				conversationsStore.addOrUpdate(targetChatId, conversationTitle, !newPinnedState);
				toast.error('Failed to update pin status');
			}
		} catch (err) {
			console.error('[Chat Detail] Pin toggle catch error, reverting:', err);
			isPinned = !newPinnedState;
			conversationsStore.addOrUpdate(targetChatId, conversationTitle, !newPinnedState);
			toast.error('Failed to update pin status');
		}
	}

	async function deleteCurrentConversation() {
		if (isConversationDeleting) return;

		isConversationDeleting = true;
		try {
			const result = await deleteConversation(chatId);
			if (!result.ok) {
				toast.error(result.error.message);
				return;
			}

			conversationsStore.remove(chatId);
			isDeleteConversationDialogOpen = false;
			showSuccess('Conversation deleted', '');
			await goto('/app/chat');
		} catch (err) {
			console.error('[Chat Detail] Failed to delete conversation:', err);
			toast.error('Failed to delete conversation');
		} finally {
			isConversationDeleting = false;
		}
	}

	async function shareConversation() {
		// A share must never snapshot an in-flight ("processing") turn, and only
		// makes sense once the conversation has at least one answer — success
		// or failure.
		if (isShareDisabled) return;
		isShareDialogOpen = true;
	}

	function scrollToCheckpoint(messageId: string) {
		activeCheckpointId = messageId;
		if (pulseCheckpointTimeout) clearTimeout(pulseCheckpointTimeout);
		if (checkpointVisibilityTimeout) clearTimeout(checkpointVisibilityTimeout);

		const targetElement = document.getElementById(`chat-message-${messageId}`);
		if (targetElement && chatContainer) {
			const containerRect = chatContainer.getBoundingClientRect();
			const elementRect = targetElement.getBoundingClientRect();
			const targetScrollTop =
				chatContainer.scrollTop +
				(elementRect.top - containerRect.top) -
				containerRect.height / 2 +
				elementRect.height / 2;

			chatContainer.scrollTo({
				top: Math.max(0, targetScrollTop),
				behavior: 'smooth'
			});
		}

		waitForCheckpointVisibility(messageId);
	}

	function waitForCheckpointVisibility(messageId: string, attempt = 0) {
		const element = document.getElementById(`chat-message-${messageId}`);
		if (!element || !chatContainer) return;

		const elementRect = element.getBoundingClientRect();
		const containerRect = chatContainer.getBoundingClientRect();
		const isVisible =
			elementRect.top >= containerRect.top && elementRect.bottom <= containerRect.bottom;

		if (isVisible || attempt >= 24) {
			pulseCheckpointId = messageId;
			pulseCheckpointTimeout = setTimeout(() => {
				pulseCheckpointId = null;
				pulseCheckpointTimeout = null;
			}, 1000);
			return;
		}

		checkpointVisibilityTimeout = setTimeout(
			() => waitForCheckpointVisibility(messageId, attempt + 1),
			50
		);
	}

	function toggleMobileReferences() {
		isMobileReferencesOpen = !isMobileReferencesOpen;
		isMobileTitleActionsOpen = false;
		isTitleMenuOpen = false;
	}

	function toggleMobileTitleActions() {
		isMobileTitleActionsOpen = !isMobileTitleActionsOpen;
		isMobileReferencesOpen = false;
		isTitleMenuOpen = false;
	}

	onMount(async () => {
		console.log(`[Chat Detail] Mounted view for chat ID: ${chatId}`);

		// Warm the document mention cache — idempotent, and the `@` popover also
		// ensures it lazily, so this only makes the first mention instant.
		documentsStore.ensureLoaded();

		// Warm up speech voices — they load asynchronously. getVoices() returns []
		// until the voiceschanged event fires, so listen for it and cache the list.
		if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
			const synth = window.speechSynthesis;
			speechVoices = synth.getVoices();
			console.log('[ReadAloud] onMount warm-up voices =', speechVoices.length);
			synth.addEventListener?.('voiceschanged', () => {
				speechVoices = synth.getVoices();
				console.log('[ReadAloud] voiceschanged: voices =', speechVoices.length);
			});
		}

		try {
			const res = await getMeUsageCached();
			if (res.ok) {
				baseUploads = res.data.uploadsCount;
				baseStorage = res.data.storageUsedBytes;
				searchesCount = res.data.searchesCount;
				qaCount = res.data.qaCount;

				const userTier: TierType = (res.data.tier as TierType) ?? 'FREE';
				const limits = TIER_LIMITS[userTier] ?? TIER_LIMITS.FREE;
				maxUploads = limits.maxUploadsPerMonth;
				maxStorage = limits.maxStorageBytes;
				maxFileSizeBytes = limits.maxFileSizeBytes;
				maxSearches = limits.maxSearchesPerMonth;
				maxQa = limits.maxQnaPerMonth;
			}
		} catch (err) {
			console.error('[Chat Detail] Failed to fetch usage metrics:', err);
		}

		await loadLlmOptions();
	});

	// Revalidate aktif conversation saat tab kembali fokus (mis. streaming
	// selesai di tab lain) — SWR background, tanpa mengganggu UI yang berjalan.
	onMount(() => {
		document.addEventListener('visibilitychange', handleVisibilityRevalidate);
		return () => document.removeEventListener('visibilitychange', handleVisibilityRevalidate);
	});

	function handleVisibilityRevalidate() {
		if (document.visibilityState !== 'visible' || isGenerating) return;
		void conversationCache.refresh(chatId).then((res) => {
			if (res.ok && res.data && !res.notModified) {
				applyConversationData(res.data);
			}
		});
	}

	$effect(() => {
		if (messages.length) {
			tick().then(() => {
				scrollToBottom();
				updateActiveCheckpoint();
			});
		}
	});

	// Conversation polling for turns awaiting background completion (attachment
	// mode, or normal turns handed off when the user left the page): the turn
	// request returned immediately; the server-side sweep completes it. Poll
	// the conversation until every awaiting turn resolves.
	$effect(() => {
		const hasAwaitingTurn = messages.some((m) => m.status === 'awaiting_indexing');
		if (!hasAwaitingTurn) return;

		// Keep the thinking rotation alive while waiting (e.g. after returning
		// to the page), leading with the waiting-for-documents statuses when
		// any awaiting turn carries attachments.
		if (!thinkingTimer) {
			startThinkingTimer(
				messages.some(
					(m) => m.status === 'awaiting_indexing' && (m.attachmentDocumentIds?.length ?? 0) > 0
				)
					? ATTACHMENT_WAITING_STATUSES
					: []
			);
		}

		let cancelled = false;
		const interval = setInterval(async () => {
			if (cancelled) return;
			try {
				const res = await getConversation(chatId);
				if (!res.ok || cancelled) return;
				for (const turn of res.data.turns) {
					if (turn.status === 'awaiting_indexing') continue;
					const asst = messages.find((m) => m.role === 'assistant' && m.turnId === turn.id);
					if (!asst || asst.status !== 'awaiting_indexing') continue;
					asst.status = turn.status as ChatMessage['status'];
					asst.content = turn.answer;
					asst.modelName = turn.modelUsed ?? asst.modelName;
					asst.references =
						turn.contextReferences?.map((r: any) => ({
							id: r.documentId,
							index: r.index || 1,
							name: r.title || r.documentId,
							pages: r.pages,
							snippet: r.snippet ?? undefined
						})) ?? [];
				}
				if (!messages.some((m) => m.status === 'awaiting_indexing') && !isGenerating) {
					stopThinkingTimer();
				}
			} catch (err) {
				console.error('[Chat Detail] Awaiting turn poll failed:', err);
			}
		}, 4000);

		return () => {
			cancelled = true;
			clearInterval(interval);
		};
	});

	function scrollToBottom() {
		if (chatContainer) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}
	}

	function updateActiveCheckpoint() {
		if (!chatContainer || conversationCheckpoints.length === 0) return;

		const containerRect = chatContainer.getBoundingClientRect();
		const viewportCenter = containerRect.top + containerRect.height / 2;
		let closestId: string | null = null;
		let closestDistance = Number.POSITIVE_INFINITY;

		for (const checkpoint of conversationCheckpoints) {
			const element = document.getElementById(`chat-message-${checkpoint.id}`);
			if (!element) continue;
			const rect = element.getBoundingClientRect();
			const distance = Math.abs(rect.top + rect.height / 2 - viewportCenter);
			if (distance < closestDistance) {
				closestDistance = distance;
				closestId = checkpoint.id;
			}
		}

		if (closestId) activeCheckpointId = closestId;
	}

	function showError(msg: string) {
		if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
			mobileHeaderState.showError(msg);
		} else {
			toast.error('Error', { description: msg });
		}
	}

	function showSuccess(title: string, msg: string = '') {
		if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
			mobileHeaderState.showSuccess(title, msg);
		} else {
			toast.success(title, msg ? { description: msg } : undefined);
		}
	}

	function showInfo(title: string, msg: string = '') {
		if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
			mobileHeaderState.showInfo(title, msg);
		} else {
			toast.info(title, msg ? { description: msg } : undefined);
		}
	}

	async function streamChatTurn(
		questionText: string,
		modelChoice: LlmOption,
		opts: {
			editTurnId?: string;
			retryTurnId?: string;
			selectedVariantId?: string;
			/** Attachments for this turn, already uploaded (initial navigation
			 * state) or carried over from the original message (edit/retry).
			 * When absent and files are attached locally, they are uploaded
			 * right here before the turn is sent. */
			attachments?: ChatAttachment[];
		} = {}
	) {
		if (!questionText || isGenerating || isUploadingAttachments) return;

		activeTurnWriteTargetId = null;

		const isRetryMode = !!opts.retryTurnId;
		const useByok = modelChoice.provider !== 'auto';

		// Resolve the attachments that scope this turn's RAG retrieval:
		// 1. Already-uploaded docs (initial question from /app/chat state, or
		//    edit/retry reusing the ids stored on the original message);
		// 2. Locally attached files — upload them as tenant documents now
		//    (the pg_net trigger hands them to the STB worker, and the server
		//    waits for ingestion before answering).
		let attachmentDocs: ChatAttachment[] = [];
		if (opts.attachments && opts.attachments.length > 0) {
			attachmentDocs = opts.attachments;
		} else if (!isRetryMode && attachedFiles.length > 0) {
			isUploadingAttachments = true;
			const uploadRes = await uploadFilesAsDocuments(attachedFiles);
			isUploadingAttachments = false;
			if (!uploadRes.ok) {
				showError(uploadRes.error);
				return;
			}
			attachmentDocs = uploadRes.attachments;
			// Newly uploaded documents are now referenceable via `@` — drop the
			// mention cache so the next popover shows them.
			documentsStore.invalidate();
		}
		// `@[title](id)` mention tokens live in the question text itself — the
		// backend parses them for retrieval scoping and strips them from the
		// LLM prompts. The payload only carries FILE attachments here.
		const bodyPayload: Record<string, any> = {
			question: questionText,
			conversation_id: chatId,
			useByok
		};
		// Attachment mode: the server scopes retrieval to these documents (the
		// backend answers immediately when they are all already indexed).
		if (attachmentDocs.length > 0) {
			bodyPayload.attachment_document_ids = attachmentDocs.map((a) => a.documentId);
		}
		// Edit mode: overwrite the existing turn in place instead of creating a new one.
		if (opts.editTurnId) bodyPayload.edit_turn_id = opts.editTurnId;
		// Retry mode: stream a new variant of the latest turn instead of a new turn.
		if (opts.retryTurnId) bodyPayload.retry_turn_id = opts.retryTurnId;
		// Follow-up: the retry variant the user is currently viewing becomes the
		// history context; the server promotes it on success and deletes the
		// unselected variants.
		if (opts.selectedVariantId) bodyPayload.selected_variant_id = opts.selectedVariantId;

		if (useByok) {
			bodyPayload.provider = modelChoice.provider;
			bodyPayload.model = modelChoice.model;
		}

		// NOTE: the outbound payload is deliberately NOT logged — it contains
		// the user's question text (privacy).

		// Retry mode targets the latest assistant message — no new messages are
		// pushed; the streamed answer lands in a new variant of that message.
		let retryVariant: ChatVariant | null = null;
		let prevLatestAsstMsg: ChatMessage | null = null;
		let userMsg: ChatMessage | null = null;

		if (isRetryMode) {
			const targetMsg = messages[messages.length - 1];
			if (!targetMsg || targetMsg.role !== 'assistant' || !opts.retryTurnId) return;
			retryVariant = {
				id: `variant-${Date.now()}`,
				answer: '',
				status: 'processing',
				modelUsed: null,
				latencyMs: null,
				contextReferences: null,
				createdAt: new Date().toISOString(),
				references: [],
				isStreaming: true
			};
			targetMsg.variants = [...(targetMsg.variants ?? []), retryVariant];
			targetMsg.variantIndex = targetMsg.variants.length;
			targetMsg.isRetrying = true;
		} else {
			// The turn this follow-up builds on — pruned locally on success to
			// mirror the server-side cleanup of unselected variants.
			prevLatestAsstMsg =
				messages[messages.length - 1]?.role === 'assistant' ? messages[messages.length - 1] : null;

			userMsg = {
				id: `user-${Date.now()}`,
				role: 'user',
				content: questionText,
				timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
				turnId: opts.editTurnId,
				attachments: attachmentDocs.map((a) => ({
					name: a.name,
					size: a.size,
					documentId: a.documentId
				}))
			};

			messages = [...messages, userMsg];
			inputValue = '';
			attachedFiles = [];
		}
		isGenerating = true;
		// Attachment turns answer via the background sweep — lead the thinking
		// rotation with the waiting-for-documents statuses.
		startThinkingTimer(
			!isRetryMode && !opts.editTurnId && attachmentDocs.length > 0
				? ATTACHMENT_WAITING_STATUSES
				: []
		);

		// Instantly move active conversation item to top of sidebar
		conversationsStore.addOrUpdate(chatId, conversationTitle);

		const assistantMsgId = `asst-${Date.now()}`;
		const assistantMsg: ChatMessage = {
			id: assistantMsgId,
			role: 'assistant',
			modelName: modelChoice.name,
			timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
			content: '',
			isStreaming: !isRetryMode,
			isCancelled: false,
			references: []
		};

		if (!isRetryMode) messages = [...messages, assistantMsg];
		const asstIndex = messages.length - 1;

		// Stream write/read routing: retry mode writes into the active variant,
		// normal mode writes into the assistant message as before. The variant is
		// resolved through the reactive proxy on every access — mutating the raw
		// object reference would bypass $state and the UI would never re-render.
		const activeRetryVariant = (): ChatVariant | null =>
			isRetryMode ? activeVariantOf(messages[asstIndex]) : null;
		const readDisplayedContent = () => {
			const v = activeRetryVariant();
			return v ? v.answer : messages[asstIndex].content;
		};
		const writeDisplayedContent = (text: string) => {
			const v = activeRetryVariant();
			if (v) v.answer = text;
			else messages[asstIndex].content = text;
		};
		const readDisplayedRefs = (): DocReference[] => {
			const v = activeRetryVariant();
			return v ? (v.references ?? []) : (messages[asstIndex].references ?? []);
		};
		const writeDisplayedRefs = (refs: DocReference[]) => {
			const v = activeRetryVariant();
			if (v) v.references = refs;
			else messages[asstIndex].references = refs;
		};
		const setMsgStreaming = (value: boolean) => {
			messages[asstIndex].isRetrying = false;
			const v = activeRetryVariant();
			if (v) v.isStreaming = value;
			else messages[asstIndex].isStreaming = value;
		};

		let streamBuffer = '';
		let isStreamDone = false;
		let streamHadError = false;
		let typewriterTimer: ReturnType<typeof setInterval> | null = null;
		let wasCancelled = false;

		const startTypewriter = () => {
			if (typewriterTimer) clearInterval(typewriterTimer);
			typewriterTimer = setInterval(() => {
				if (isStreamDone) {
					// Generation finished — flush any remaining buffer immediately so
					// the displayed text never lags the actual response. This keeps
					// the "Stop" button live only while the stream is genuinely
					// generating, so an abort always lands mid-SSE and the server
					// persists a partial answer with status=stopped.
					if (readDisplayedContent().length < streamBuffer.length) {
						writeDisplayedContent(streamBuffer);
						if (chatContainer) {
							chatContainer.scrollTop = chatContainer.scrollHeight;
						}
					}
					clearInterval(typewriterTimer!);
					typewriterTimer = null;

					setMsgStreaming(false);
					isGenerating = false;
					if (activeAbortController === abortController) {
						activeAbortController = null;
						cancelActiveStream = null;
						activeStreamReader = null;
					}
					isTitleLoading = false;
					// Awaiting turns keep the thinking rotation running — their
					// answer arrives via the background sweep, not the stream.
					if (messages[asstIndex].status !== 'awaiting_indexing') {
						stopThinkingTimer();
					}

					if (streamHadError) {
						if (!isRetryMode) messages[asstIndex].references = [];
						return;
					}

					const textContent = readDisplayedContent();
					const currentRefs = readDisplayedRefs();

					if (currentRefs && currentRefs.length > 0) {
						const isNegativeAnswer =
							/(Mohon maaf|tidak mengandung informasi|tidak ditemukan|tidak ada informasi|does not contain|cannot answer|no information available)/i.test(
								textContent
							);
						const citationMatches = [
							...textContent.matchAll(/\[Doc (\d+)(?::\s*(?:Hlm\.|Pages?|Page)?\s*([^\]]+))?\]/gi)
						];

						if (isNegativeAnswer || citationMatches.length === 0) {
							writeDisplayedRefs([]);
						} else {
							const citedPagesMap = new Map<number, Set<number>>();
							for (const match of citationMatches) {
								const docIdx = Number(match[1]);
								const pagesStr = match[2];
								if (!citedPagesMap.has(docIdx)) {
									citedPagesMap.set(docIdx, new Set());
								}
								if (pagesStr) {
									const numMatches = pagesStr.match(/\d+/g);
									if (numMatches) {
										for (const n of numMatches) {
											citedPagesMap.get(docIdx)!.add(Number(n));
										}
									}
								}
							}

							const filteredRefs: DocReference[] = [];
							for (const ref of currentRefs) {
								const docIdx = ref.index || 1;
								const citedSet = citedPagesMap.get(docIdx);
								if (citedSet) {
									const sortedCitedPages = Array.from(citedSet).sort((a, b) => a - b);
									filteredRefs.push({
										...ref,
										pages: sortedCitedPages.length > 0 ? sortedCitedPages : ref.pages
									});
								}
							}
							writeDisplayedRefs(filteredRefs);
						}
					}

					// Follow-up succeeded (normal mode): prune the previous turn's
					// variants locally, mirroring the server-side promote + delete.
					// The selected variant (if any) becomes the message's canonical
					// content; unselected variants disappear.
					if (
						!isRetryMode &&
						!opts.editTurnId &&
						prevLatestAsstMsg &&
						prevLatestAsstMsg.variants &&
						prevLatestAsstMsg.variants.length > 0
					) {
						if (opts.selectedVariantId) {
							const kept = prevLatestAsstMsg.variants.find((v) => v.id === opts.selectedVariantId);
							if (kept) {
								prevLatestAsstMsg.content = kept.answer;
								prevLatestAsstMsg.references = kept.references ?? [];
							}
						}
						prevLatestAsstMsg.variants = [];
						prevLatestAsstMsg.variantIndex = 0;
						prevLatestAsstMsg.isRetrying = false;
					}
				} else if (readDisplayedContent().length < streamBuffer.length) {
					const delta = Math.min(3, streamBuffer.length - readDisplayedContent().length);
					writeDisplayedContent(
						readDisplayedContent() +
							streamBuffer.substring(
								readDisplayedContent().length,
								readDisplayedContent().length + delta
							)
					);
					if (chatContainer) {
						chatContainer.scrollTop = chatContainer.scrollHeight;
					}
				}
			}, 18);
		};

		startTypewriter();
		const abortController = new AbortController();
		activeAbortController = abortController;
		cancelActiveStream = () => {
			wasCancelled = true;
			abortController.abort();
			// Cancel the response body reader to stop the SSE stream mid-flight.
			// Absorb the rejection — cancel() on an already-aborted reader rejects.
			activeStreamReader?.cancel().catch(() => {});
			activeStreamReader = null;
			if (typewriterTimer) {
				clearInterval(typewriterTimer);
				typewriterTimer = null;
			}
			// Freeze at everything received so far — this is the partial the
			// server persists as "stopped". If the stream already completed
			// (isStreamDone), the answer is complete, not stopped.
			const activeVar = activeRetryVariant();
			if (activeVar) {
				activeVar.answer = streamBuffer;
				activeVar.isStreaming = false;
				activeVar.status = isStreamDone ? 'complete' : 'stopped';
				messages[asstIndex].isRetrying = false;
			} else {
				messages[asstIndex].content = streamBuffer;
				messages[asstIndex].isStreaming = false;
				messages[asstIndex].isCancelled = true;
				messages[asstIndex].status = isStreamDone ? 'complete' : 'stopped';
			}
			isGenerating = false;
			isTitleLoading = false;
			stopThinkingTimer();
			if (activeAbortController === abortController) {
				activeAbortController = null;
				cancelActiveStream = null;
			}
		};

		try {
			const headers: Record<string, string> = {
				'Content-Type': 'application/json'
			};

			const res = await dokyudoFetch(`${PUBLIC_API_URL}/api/rag/chat`, {
				method: 'POST',
				headers,
				body: JSON.stringify(bodyPayload),
				signal: abortController.signal
			});

			if (!res.ok) {
				const errorData = await res
					.json()
					.catch(() => ({ message: 'Failed to start chat stream' }));
				console.error('[Chat Detail] Backend Response Error:', errorData);
				const errorMessage: string =
					errorData?.error?.message ?? errorData?.message ?? 'Error executing chat request';
				showError(errorMessage);
				setMsgStreaming(false);
				isGenerating = false;
				isTitleLoading = false;
				stopThinkingTimer();
				if (typewriterTimer) clearInterval(typewriterTimer);
				return;
			}

			if (!res.body) {
				showError('No response body returned from server');
				setMsgStreaming(false);
				isGenerating = false;
				isTitleLoading = false;
				stopThinkingTimer();
				if (typewriterTimer) clearInterval(typewriterTimer);
				return;
			}

			const reader = res.body.getReader();
			activeStreamReader = reader;
			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				// Race reader.read() against the abort signal so cancel feels instant.
				const readPromise = reader.read();
				let onAbort: (() => void) | null = null;
				const abortPromise = new Promise<never>((_, reject) => {
					if (abortController.signal.aborted) {
						reject(new DOMException('Aborted', 'AbortError'));
					} else {
						onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
						abortController.signal.addEventListener('abort', onAbort, { once: true });
					}
				});
				let value: Uint8Array | undefined;
				let done = false;
				try {
					const result = await Promise.race([readPromise, abortPromise]);
					if (onAbort) abortController.signal.removeEventListener('abort', onAbort);
					value = result.value;
					done = result.done;
				} catch (_err) {
					// Abort won the race → exit the loop cleanly.
					// Absorb the orphaned readPromise rejection (it rejects with AbortError too).
					readPromise.catch(() => {});
					break;
				}
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const blocks = buffer.split('\n\n');
				buffer = blocks.pop() || '';

				for (const block of blocks) {
					if (!block.trim()) continue;
					const lines = block.split('\n');
					let eventName = '';
					let dataStr = '';

					for (const line of lines) {
						const trimmed = line.trim();
						if (trimmed.startsWith('event:')) {
							eventName = trimmed.slice(6).trim();
						} else if (trimmed.startsWith('data:')) {
							dataStr = trimmed.slice(5).trim();
						}
					}

					if (eventName === 'turn_started' && dataStr) {
						try {
							const parsed = JSON.parse(dataStr);
							// The write-target id arrives before any token, so a stream that gets
							// cancelled still leaves the turn id needed for retry/edit — no reload.
							const startedVar = activeRetryVariant();
							if (parsed.variantId && startedVar) {
								startedVar.id = parsed.variantId;
								// Variant rows are the write target for retries —
								// the stop endpoint needs this id too.
								activeTurnWriteTargetId = parsed.variantId;
							} else if (parsed.turnId && userMsg) {
								userMsg.turnId = parsed.turnId;
								messages[asstIndex].turnId = parsed.turnId;
								activeTurnWriteTargetId = parsed.turnId;
							}
						} catch (e) {
							console.error('[Chat Detail] Failed to parse turn_started event:', e);
						}
					} else if (eventName === 'references' && dataStr) {
						try {
							const parsed = JSON.parse(dataStr);
							if (parsed.references) {
								// Assign references immediately so inline citations render file names
								// while the answer is still typing. The Source References block below
								// the message is only shown once the stream is fully done.
								const mappedRefs = parsed.references.map((r: any, idx: number) => ({
									id: r.documentId,
									index: r.index || idx + 1,
									name: r.title || r.documentId,
									pages: r.pages,
									snippet: r.snippet ?? undefined
								}));
								writeDisplayedRefs(mappedRefs);
							}
						} catch (e) {
							console.error('[Chat Detail] Failed to parse references event:', e);
						}
					} else if (eventName === 'awaiting_indexing' && dataStr) {
						try {
							const parsed = JSON.parse(dataStr);
							// Attachment mode: the server returns immediately and
							// completes the turn in the background sweep. Mark the
							// message so the UI shows the waiting state and the
							// conversation poll takes over.
							messages[asstIndex].status = 'awaiting_indexing';
							if (Array.isArray(parsed.attachmentDocumentIds)) {
								const ids: string[] = parsed.attachmentDocumentIds;
								messages[asstIndex].attachmentDocumentIds = ids;
								if (userMsg) userMsg.attachmentDocumentIds = ids;
							}
						} catch (e) {
							console.error('[Chat Detail] Failed to parse awaiting_indexing event:', e);
						}
					} else if (eventName === 'token' && dataStr) {
						try {
							const parsed = JSON.parse(dataStr);
							if (parsed.token) {
								streamBuffer += parsed.token;
							}
						} catch (e) {
							console.error('[Chat Detail] Failed to parse token event:', e);
						}
					} else if (eventName === 'title' && dataStr) {
						try {
							const parsed = JSON.parse(dataStr);
							if (parsed.title) {
								conversationTitle = parsed.title;
								isTitleLoading = false;
								conversationsStore.addOrUpdate(chatId, parsed.title);
								console.log('[Chat Detail] Real-time title updated:', parsed.title);
							}
						} catch (e) {
							console.error('[Chat Detail] Failed to parse title event:', e);
						}
					} else if (eventName === 'warning' && dataStr) {
						try {
							const parsed = JSON.parse(dataStr);
							if (parsed.code === 'PROMPT_INJECTION') {
								// The server persists "Nice try, Diddy." + status=blocked;
								// mirror both locally so the UI shows the blocked state
								// immediately, without waiting for a reload.
								streamBuffer = 'Nice try, Diddy.';
								const warnVar = activeRetryVariant();
								if (warnVar) warnVar.status = 'blocked';
								else {
									messages[asstIndex].isRejection = true;
									messages[asstIndex].status = 'blocked';
								}
								console.log('[Chat Detail] Prompt injection detected via SSE warning event.');
							}
						} catch (e) {
							console.error('[Chat Detail] Failed to parse warning event:', e);
						}
					} else if (eventName === 'done') {
						isStreamDone = true;
						// The server echoes the persisted turn id — lets the user edit
						// this turn in place later (or rate it) without reloading the
						// conversation.
						if (dataStr) {
							try {
								const parsed = JSON.parse(dataStr);
								const doneVar = activeRetryVariant();
								if (parsed.variantId && doneVar) {
									doneVar.id = parsed.variantId;
								} else if (parsed.turnId && userMsg) {
									userMsg.turnId = parsed.turnId;
									messages[asstIndex].turnId = parsed.turnId;
								}
							} catch {
								// Legacy done payloads (e.g. injection warning `{}`) are fine.
							}
						}
					} else if (eventName === 'error' && dataStr) {
						try {
							const parsed = JSON.parse(dataStr);
							showError(parsed.message || 'Stream error');
							console.error('[Chat Detail] Backend Response Stream Error:', parsed);
						} catch (e) {
							showError('Stream error');
						}
						streamHadError = true;
						const errVar = activeRetryVariant();
						if (errVar) errVar.status = 'failed';
						else messages[asstIndex].status = 'failed';
						isStreamDone = true;
					}
				}
			}
		} catch (err: any) {
			if (err?.name !== 'AbortError') {
				console.error('[Chat Detail] Stream Catch Error:', err);
				showError(err.message || 'Network error streaming chat');
			}
			isStreamDone = true;
		} finally {
			if (wasCancelled) {
				if (typewriterTimer) clearInterval(typewriterTimer);
			} else if (abortController.signal.aborted) {
				if (typewriterTimer) clearInterval(typewriterTimer);
				setMsgStreaming(false);
				isGenerating = false;
				isTitleLoading = false;
				stopThinkingTimer();
				if (activeAbortController === abortController) {
					activeAbortController = null;
					cancelActiveStream = null;
				}
			} else if (!streamBuffer) {
				// If buffer was empty or loop not running, ensure clean reset
				stopThinkingTimer();
				if (typewriterTimer) clearInterval(typewriterTimer);
				setMsgStreaming(false);
				isGenerating = false;
				isTitleLoading = false;
				if (activeAbortController === abortController) {
					activeAbortController = null;
					cancelActiveStream = null;
				}
			}
			// NOTE: when streamBuffer has pending content, cancelActiveStream is kept alive
			// so the stop button can interrupt the typewriter drain. The typewriter
			// completion handler clears it once the buffer is fully displayed.
			activeStreamReader = null;
		}
	}

	function handleSendMessage() {
		// Mention tokens don't count as characters — the real text decides.
		if (mentionStrippedLength(inputValue.trim()) === 0 || isGenerating || isUploadingAttachments)
			return;
		// The retry variant currently displayed (if any) is the one the
		// follow-up context is built on; nothing is sent when the canonical
		// answer is shown (server then deletes all variants on success).
		const latestAsst = [...messages].reverse().find((m) => m.role === 'assistant');
		const activeIdx = latestAsst?.variantIndex ?? 0;
		const activeVariant =
			activeIdx > 0 && latestAsst?.variants?.[activeIdx - 1]
				? latestAsst.variants[activeIdx - 1]
				: null;
		streamChatTurn(inputValue.trim(), selectedModel, {
			selectedVariantId: activeVariant ? activeVariant.id : undefined
		});
	}

	async function stopCurrentStream() {
		// Explicit server-side stop: abort the in-flight generation and mark
		// the turn "stopped". Await the ack BEFORE tearing down the local
		// stream — the server distinguishes this from a page-leave disconnect
		// (which is handed to the background sweep instead), so the order
		// matters: stop first, then disconnect.
		const targetId = activeTurnWriteTargetId;
		if (targetId) {
			try {
				await fetch(`${PUBLIC_API_URL}/api/rag/turns/${targetId}/stop`, {
					method: 'POST',
					credentials: 'include'
				});
			} catch {
				// Network hiccup — the local freeze below still applies.
			}
		}
		cancelActiveStream?.();
	}

	function retryMessage(msg: ChatMessage, userMsg: ChatMessage | undefined) {
		if (isGenerating || !userMsg || !msg.turnId) return;
		// Retry streams a NEW variant of this turn (the latest one) instead
		// of creating a duplicate turn. The original attachments (document ids)
		// are re-sent so the retried answer keeps the same RAG scoping.
		streamChatTurn(userMsg.content, selectedModel, {
			retryTurnId: msg.turnId,
			attachments: attachmentsOf(userMsg)
		});
	}

	/** Extracts already-uploaded attachments (with document ids) from a message.
	 * Prefers the server-persisted ids (survive reloads); falls back to the
	 * local attachment chips for the current session. */
	function attachmentsOf(msg: ChatMessage | undefined): ChatAttachment[] | undefined {
		const persistedIds = msg?.attachmentDocumentIds;
		if (persistedIds && persistedIds.length > 0) {
			// Persisted ids win (they survive reloads); reuse the display titles
			// from the local chips when this turn was loaded in the session.
			const names = new Map(
				(msg?.attachments ?? []).filter((a) => a.documentId).map((a) => [a.documentId!, a.name])
			);
			return persistedIds.map((documentId) => ({
				documentId,
				name: names.get(documentId) ?? 'Document',
				size: 0
			}));
		}
		const docs = msg?.attachments
			?.map((a) =>
				a.documentId ? { documentId: a.documentId, name: a.name, size: a.size ?? 0 } : null
			)
			.filter((a): a is ChatAttachment => a !== null);
		return docs && docs.length > 0 ? docs : undefined;
	}

	function browseVariant(msg: ChatMessage, delta: number) {
		if (isGenerating) return;
		triggerHaptic(15);
		const max = msg.variants?.length ?? 0;
		msg.variantIndex = Math.min(max, Math.max(0, (msg.variantIndex ?? 0) + delta));
	}

	function resizeEditingTextInput() {
		if (!editingTextInput) return;
		editingTextInput.style.height = 'auto';
		editingTextInput.style.height = `${Math.max(editingTextInput.scrollHeight, 80)}px`;
	}

	async function beginEditMessage(msg: ChatMessage) {
		triggerHaptic(15);
		editingMessageId = msg.id;
		editingMessageValue = msg.content;
		await tick();
		resizeEditingTextInput();
	}

	function cancelEditMessage() {
		editingMessageId = null;
		editingMessageValue = '';
	}

	function saveEditMessage(msg: ChatMessage) {
		const editedPrompt = editingMessageValue.trim();
		if (mentionStrippedLength(editedPrompt) === 0 || isGenerating) return;
		triggerHaptic(20);
		const msgIndex = messages.indexOf(msg);
		if (msgIndex !== -1) {
			// Remove the edited question and everything after it — the turn is
			// regenerated in place via edit_turn_id, so the old answer must not
			// linger in the transcript.
			messages = messages.slice(0, msgIndex);
		}
		cancelEditMessage();
		streamChatTurn(editedPrompt, selectedModel, {
			editTurnId: msg.turnId,
			attachments: attachmentsOf(msg)
		});
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	}

	function copyToClipboard(text: string, msgId: string) {
		triggerHaptic(25);
		const cleanText = text.replace(/\s*\[Doc [^\]]+\]/gi, '').trim();
		navigator.clipboard.writeText(cleanText);
		copiedMessageId = msgId;
		showSuccess('Copied to clipboard', '');
		setTimeout(() => {
			if (copiedMessageId === msgId) copiedMessageId = null;
		}, 2000);
	}

	async function toggleFeedback(msg: ChatMessage, rating: 'good' | 'bad') {
		if (!msg.turnId) return;
		triggerHaptic(20);
		const prev = msg.feedback ?? null;
		// Clicking the active rating again clears it.
		const next = prev === rating ? null : rating;
		// Optimistic update — revert on failure.
		msg.feedback = next;

		if (next === 'good') {
			showSuccess('Feedback recorded', 'Helpful response');
		} else if (next === 'bad') {
			showInfo('Feedback recorded', 'Needs improvement');
		} else {
			showInfo('Feedback cleared', '');
		}

		console.log('[Chat Detail] Updating turn feedback:', { turnId: msg.turnId, rating: next });
		const result = await updateTurnFeedback(chatId, msg.turnId, { rating: next });
		if (!result.ok) {
			msg.feedback = prev;
			toast.error(result.error.message);
		}
	}

	async function branchFromMessage(msgIndex: number) {
		const msg = messages[msgIndex];
		if (!msg?.turnId) {
			toast.error('Cannot branch — this message is not ready yet');
			return;
		}
		closeResponseMenu();
		const result = await branchConversation(chatId, msg.turnId);
		if (!result.ok) {
			toast.error(result.error.message);
			return;
		}
		// Push the new branch to the top of the sidebar before navigating.
		conversationsStore.addOrUpdate(result.data.id, result.data.title);
		showSuccess('Branch created', '');
		await goto(`/app/chat/${result.data.id}`);
	}

	// ---- Web Speech API (Read Aloud) ----
	/** Show the Chrome suggestion at most once per session. */
	let ttsChromeHintShown = false;

	/** Firefox on Linux often ships without any TTS voices (no speech backend). */
	function isFirefoxOnLinux(): boolean {
		if (typeof navigator === 'undefined') return false;
		const ua = navigator.userAgent.toLowerCase();
		return ua.includes('firefox') && ua.includes('linux');
	}

	/** Cheap heuristic: counts language markers to pick an id/en voice. */
	function detectSpeechLang(text: string): string {
		const lower = text.toLowerCase();
		const idMarkers = [
			' yang ',
			' dan ',
			' dengan ',
			' untuk ',
			' pada ',
			' adalah ',
			' tidak ',
			' mohon '
		];
		const enMarkers = [' the ', ' and ', ' with ', ' for ', ' is ', ' are ', ' not ', ' please '];
		let idScore = 0;
		let enScore = 0;
		for (const m of idMarkers) if (lower.includes(m)) idScore++;
		for (const m of enMarkers) if (lower.includes(m)) enScore++;
		return idScore >= enScore ? 'id' : 'en';
	}

	function pickVoice(lang: string): SpeechSynthesisVoice | null {
		// Use the cached voices (populated by voiceschanged) — a fresh
		// getVoices() call can still return [] on the first click.
		const voices = speechVoices;
		console.log(
			'[ReadAloud] pickVoice: voices =',
			voices.length,
			voices.map((v) => `${v.lang}:${v.name}`).slice(0, 8)
		);
		if (voices.length === 0) {
			console.warn(
				'[ReadAloud] No speech voices available — TTS may be disabled in this browser/OS ' +
					'(common on Linux Chrome without a speech-dispatcher backend). speak() may silently do nothing.'
			);
			return null;
		}
		const normalized = lang.toLowerCase();
		const chosen =
			voices.find((v) => v.lang.toLowerCase().startsWith(normalized)) ??
			voices.find((v) => v.lang.toLowerCase().startsWith('en')) ??
			voices[0];
		console.log(
			'[ReadAloud] pickVoice: want =',
			normalized,
			'| chosen =',
			chosen?.lang,
			chosen?.name
		);
		return chosen;
	}

	/** Strips citation tags and markdown syntax so the answer reads naturally. */
	function textForSpeech(raw: string): string {
		if (!raw) return '';
		return raw
			.replace(/\s*\[Doc [^\]]+\]/gi, '')
			.replace(/```[\s\S]*?```/g, ' code block ')
			.replace(/`([^`]*)`/g, '$1')
			.replace(/^#{1,6}\s*/gm, '')
			.replace(/\*\*([^*]+)\*\*/g, '$1')
			.replace(/\*([^*]+)\*/g, '$1')
			.replace(/__([^_]+)__/g, '$1')
			.replace(/_([^_]+)_/g, '$1')
			.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
			.replace(/^\s*[-*+]\s+/gm, '')
			.replace(/^\s*\d+[.)]\s+/gm, '')
			.replace(/\s+/g, ' ')
			.trim();
	}

	function stopSpeaking() {
		console.log('[ReadAloud] stopSpeaking()');
		// SSR-safe: the page renders on the server where `window` doesn't exist.
		if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
			// Only cancel when something is actually active. An unnecessary
			// cancel() right before speak() can make Chrome silently drop the
			// next utterance (known Chrome quirk).
			if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
				console.log('[ReadAloud] stopSpeaking: cancel()');
				window.speechSynthesis.cancel();
			}
		}
		speakingMessageId = null;
	}

	function toggleReadAloud(msgIndex: number) {
		const msg = messages[msgIndex];
		console.log(
			'[ReadAloud] toggleReadAloud() msgIndex =',
			msgIndex,
			'| msg =',
			msg?.id,
			'| speaking =',
			speakingMessageId
		);
		if (!msg || msg.role !== 'assistant') return;
		if (speakingMessageId === msg.id) {
			stopSpeaking();
			return;
		}
		if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
			console.log('[ReadAloud] speechSynthesis NOT supported');
			toast.error('Text-to-speech is not supported in this browser');
			return;
		}
		// Firefox on Linux often has zero TTS voices — suggest Chrome once.
		if (!ttsChromeHintShown && isFirefoxOnLinux()) {
			ttsChromeHintShown = true;
			showInfo(
				'Use Chrome for a better read-aloud experience',
				'Firefox on Linux often has no speech voices installed.'
			);
		}
		console.log(
			'[ReadAloud] state: speaking =',
			window.speechSynthesis.speaking,
			'| paused =',
			window.speechSynthesis.paused,
			'| pending =',
			window.speechSynthesis.pending
		);
		// Whether something was actively speaking before we reset (used to decide
		// if speak() must be deferred past a real cancel()).
		const wasActive = window.speechSynthesis.speaking || window.speechSynthesis.pending;
		stopSpeaking();
		const text = textForSpeech(msg.content);
		console.log('[ReadAloud] text length =', text.length, '| raw length =', msg.content.length);
		if (!text) {
			showInfo('Nothing to read aloud', '');
			return;
		}
		const lang = detectSpeechLang(text);
		const utterance = new SpeechSynthesisUtterance(text);
		const voice = pickVoice(lang);
		if (voice) utterance.voice = voice;
		else if (speechVoices.length === 0) {
			// The environment has no TTS voices (e.g. Firefox/Linux without a
			// speech backend) — surface it instead of failing silently.
			toast.error('No speech voices available in this browser', {
				description: 'On Linux, install a speech backend (speech-dispatcher) or use Chrome.'
			});
		}
		// Always set an explicit lang — Chrome can pick a default voice for the
		// language even when getVoices() is still empty.
		utterance.lang = voice?.lang ?? (lang === 'id' ? 'id-ID' : 'en-US');
		utterance.onstart = () => console.log('[ReadAloud] utterance.onstart fired');
		utterance.onend = () => {
			console.log('[ReadAloud] utterance.onend fired');
			if (speakingMessageId === msg.id) speakingMessageId = null;
		};
		utterance.onerror = (event) => {
			console.error('[ReadAloud] utterance.onerror:', event.error);
			if (speakingMessageId === msg.id) speakingMessageId = null;
		};
		console.log(
			'[ReadAloud] speak() -> lang =',
			utterance.lang,
			'| voice =',
			utterance.voice?.name ?? '(default)',
			'| len =',
			text.length
		);
		const doSpeak = () => {
			speakingMessageId = msg.id;
			try {
				window.speechSynthesis.speak(utterance);
				console.log('[ReadAloud] speak() returned, speaking =', window.speechSynthesis.speaking);
			} catch (err) {
				console.error('[ReadAloud] speak() threw:', err);
				speakingMessageId = null;
			}
		};
		if (wasActive) {
			// Chrome drops speak() called in the same tick right after a real
			// cancel() — defer it slightly in that case only.
			console.log('[ReadAloud] was active — deferring speak()');
			setTimeout(doSpeak, 100);
		} else {
			// Clean slate: speak synchronously inside the click (user gesture).
			doSpeak();
		}
	}

	function openDeleteResponseDialog(messageIndex: number) {
		const message = messages[messageIndex];
		if (!message || message.role !== 'assistant' || message.isStreaming) return;
		targetDeleteMessageIndex = messageIndex;
		isDeleteResponseDialogOpen = true;
	}

	async function confirmDeleteResponse() {
		if (targetDeleteMessageIndex === null || isResponseDeleting) return;

		const msgIndex = targetDeleteMessageIndex;
		const msg = messages[msgIndex];
		if (!msg || !msg.turnId) {
			toast.error('Unable to delete response: missing turn reference');
			isDeleteResponseDialogOpen = false;
			return;
		}

		isResponseDeleting = true;
		console.log('[Chat Detail] Deleting turn:', {
			conversationId: chatId,
			turnId: msg.turnId,
			messageIndex: msgIndex
		});

		try {
			const result = await deleteTurn(chatId, msg.turnId);
			console.log('[Chat Detail] Delete turn backend response:', result);

			if (!result.ok) {
				toast.error(result.error.message);
				return;
			}

			messages = messages.filter(
				(_item, index) =>
					index !== msgIndex && !(index === msgIndex - 1 && messages[index].role === 'user')
			);

			conversationCache.invalidate(chatId);
			isDeleteResponseDialogOpen = false;
			targetDeleteMessageIndex = null;
			showSuccess('Response deleted', '');
		} catch (err) {
			console.error('[Chat Detail] Failed to delete turn:', err);
			toast.error('Failed to delete response');
		} finally {
			isResponseDeleting = false;
		}
	}
</script>

<svelte:head>
	{@html seo({
		title:
			conversationTitle && conversationTitle !== 'New Conversation'
				? `${conversationTitle} | Dokyudo`
				: 'Chat | Dokyudo',
		description: 'Ask questions and get answers powered by your documents.',
		noindex: true
	})}
</svelte:head>

<div class="relative flex h-full w-full overflow-hidden bg-transparent font-sans text-white">
	{#if citationPreview}
		<!-- Mobile: full-screen preview -->
		<div class="fixed inset-0 z-[60] h-full w-full bg-[#1F1E1D] md:hidden">
			<PdfPreviewPanel
				src={citationPreview.src}
				name={citationPreview.name}
				initialPages={citationPreview.pages}
				onclose={closeCitationPreview}
			/>
		</div>
		<!-- Desktop: resizable split -->
		<div class="hidden h-full w-full md:block">
			<Resizable.PaneGroup direction="horizontal" autoSaveId="chat-layout">
				<Resizable.Pane defaultSize={60} minSize={30}>
					{@render chatContent()}
				</Resizable.Pane>
				<Resizable.Handle
					withHandle
					class="w-1 bg-white/10 hover:bg-[#DB8F5E]/50 active:bg-[#DB8F5E]"
				/>
				<Resizable.Pane defaultSize={40} minSize={25}>
					<PdfPreviewPanel
						src={citationPreview.src}
						name={citationPreview.name}
						initialPages={citationPreview.pages}
						onclose={closeCitationPreview}
					/>
				</Resizable.Pane>
			</Resizable.PaneGroup>
		</div>
	{:else}
		{@render chatContent()}
	{/if}
</div>

{#snippet chatContent()}
	<div class="relative flex h-full w-full flex-col overflow-hidden bg-transparent">
		<!-- Reusable Mobile Floating Header Capsule -->
		<MobileHeader>
			{#snippet leading()}
				<Tooltip.Provider delayDuration={100}>
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<button
									{...props}
									type="button"
									class="flex size-9 cursor-pointer items-center justify-center rounded-full text-white/70 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-90 active:bg-white/20 active:text-white"
									onclick={() => sidebar.toggle()}
									aria-label="Open navigation"
								>
									<MxIcon name="hamburger-menu-outline" class="size-5" />
								</button>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content
							class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
						>
							<p>Toggle Menu</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>

				<Tooltip.Provider delayDuration={100}>
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<button
									{...props}
									type="button"
									class="flex size-9 cursor-pointer items-center justify-center rounded-full text-white/55 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-90 active:bg-white/20 active:text-white"
									onclick={() => goto('/app/chat')}
									aria-label="New chat"
								>
									<Plus class="size-4" />
								</button>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content
							class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
						>
							<p>New Chat</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>
			{/snippet}

			{#snippet center()}
				<button
					type="button"
					class="flex max-w-[45%] min-w-0 cursor-pointer items-center justify-center gap-1.5 truncate rounded-lg px-2 py-1 text-xs font-medium text-white/75 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-95 active:bg-white/15 active:text-white"
					onclick={toggleMobileTitleActions}
					aria-label="Conversation actions"
				>
					{#if isPinned}
						<MxIcon name="pin-bold" class="size-3.5 shrink-0 rotate-45 text-white/60" />
					{/if}
					<span class="truncate">
						{isTitleLoading ? 'Generating title...' : conversationTitle || 'New Conversation'}
					</span>
				</button>
			{/snippet}

			{#snippet trailing()}
				<Tooltip.Provider delayDuration={100}>
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<button
									{...props}
									type="button"
									class="flex size-9 cursor-pointer items-center justify-center rounded-full text-white/55 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-90 active:bg-white/20 active:text-white disabled:cursor-not-allowed disabled:opacity-40"
									onclick={shareConversation}
									disabled={isShareDisabled}
									aria-label="Share conversation"
								>
									<MxIcon name="share-outline" class="size-4" />
								</button>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content
							class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
						>
							<p>Share Conversation</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>

				<Tooltip.Provider delayDuration={100}>
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<button
									{...props}
									type="button"
									class="relative flex size-9 cursor-pointer items-center justify-center rounded-full text-white/55 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-90 active:bg-white/20 active:text-white"
									onclick={toggleMobileReferences}
									aria-label="Conversation references"
								>
									<MxIcon name="document-outline" class="size-4" />
									{#if conversationReferences.length > 0}
										<span
											class="absolute top-0 right-0 flex size-3.5 items-center justify-center rounded-full bg-[#DB8F5E] text-[9px] font-semibold text-black"
										>
											{conversationReferences.length}
										</span>
									{/if}
								</button>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content
							class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
						>
							<p>References ({conversationReferences.length})</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>
			{/snippet}

			{#snippet bottom()}
				{#if isMobileTitleActionsOpen}
					<div
						transition:slide={{ duration: 300, easing: backOut }}
						class="flex items-center justify-center gap-3 border-t border-white/[0.16] px-3 py-3"
					>
						<button
							type="button"
							class="flex size-10 cursor-pointer items-center justify-center rounded-full border border-white/[0.16] bg-[#232323]/[0.40] text-white/65 backdrop-blur-[42px] transition-all duration-150 hover:border-[0.74px] hover:border-white/[0.80] hover:bg-[#B8B5B5]/[0.40] hover:text-white/[0.80] hover:backdrop-blur-[31.16px] active:scale-90"
							onclick={() => {
								isMobileTitleActionsOpen = false;
								openTitleEditDialog();
							}}
							aria-label="Edit conversation title"
						>
							<MxIcon name="edit2-outline" class="size-4" />
						</button>
						<button
							type="button"
							class="flex size-10 cursor-pointer items-center justify-center rounded-full border {isPinned
								? 'border-amber-400/40 bg-amber-400/10 text-amber-400 active:bg-amber-400/25'
								: 'border-white/[0.16] bg-[#232323]/[0.40] text-white/65 hover:border-[0.74px] hover:border-white/[0.80] hover:bg-[#B8B5B5]/[0.40] hover:text-white/[0.80] hover:backdrop-blur-[31.16px] active:bg-white/20'} backdrop-blur-[42px] transition-all duration-150 active:scale-90"
							onclick={() => {
								isMobileTitleActionsOpen = false;
								togglePinConversation();
							}}
							aria-label={isPinned ? 'Unpin conversation' : 'Pin conversation'}
						>
							{#if isPinned}
								<MxIcon name="pin-bold" class="size-4" />
							{:else}
								<MxIcon name="pin-outline" class="size-4 rotate-45" />
							{/if}
						</button>
						<button
							type="button"
							class="flex size-10 cursor-pointer items-center justify-center rounded-full border border-red-400/20 bg-red-400/10 text-red-300 transition-all duration-150 hover:bg-red-400/20 hover:text-red-200 active:scale-90 active:bg-red-400/30 active:text-white"
							onclick={() => {
								isMobileTitleActionsOpen = false;
								isDeleteConversationDialogOpen = true;
							}}
							aria-label="Delete conversation"
						>
							<MxIcon name="trash-bin-minimalistic-outline" class="size-4" />
						</button>
					</div>
				{/if}

				{#if isMobileReferencesOpen}
					<div
						transition:slide={{ duration: 420, easing: backOut }}
						class="max-h-56 overflow-y-auto border-t border-white/[0.16] px-2 py-2"
					>
						{#if conversationReferences.length === 0}
							<div class="px-2 py-2 text-xs text-white/35">No references in this conversation.</div>
						{:else}
							{#each conversationReferences as reference (reference.id)}
								<button
									type="button"
									class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-white/70 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-[0.98] active:bg-white/15 active:text-white"
									onclick={() =>
										openCitationPreview(reference.id, reference.name, reference.pages ?? [])}
								>
									<MxIcon name="document-outline" class="size-3.5 shrink-0 text-white/50" />
									<span class="min-w-0 truncate">{reference.name}</span>
								</button>
							{/each}
						{/if}
					</div>
				{/if}
			{/snippet}
		</MobileHeader>

		<!-- Desktop Conversation Header -->
		<div
			class="pointer-events-none absolute top-0 right-0 left-0 z-20 hidden h-28 bg-gradient-to-b from-[#1F1E1D] via-[#1F1E1D]/95 via-65% to-transparent md:block"
		>
			<div class="pointer-events-auto grid h-16 w-full grid-cols-3 items-center px-4 md:px-8">
				<div class="flex justify-start">
					<button
						type="button"
						class="flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white/55 transition-colors hover:bg-white/10 hover:text-white"
						onclick={() => {
							triggerHaptic(15);
							goto('/app/chat');
						}}
					>
						<Plus class="size-4" />
						<span>New chat</span>
					</button>
				</div>

				<div class="flex min-w-0 justify-center">
					{#if (conversationTitle || '').length > 25}
						<Tooltip.Provider delayDuration={100}>
							<Tooltip.Root>
								<Tooltip.Trigger>
									{#snippet child({ props })}
										<button
											{...props}
											type="button"
											class="flex max-w-full cursor-pointer select-none items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white focus:outline-none"
											onclick={openTitleMenu}
										>
											{#if isPinned}
												<MxIcon name="pin-bold" class="size-3.5 shrink-0 rotate-45 text-white/60" />
											{/if}
											<span class="max-w-56 truncate font-medium">
												{isTitleLoading
													? 'New Conversation'
													: conversationTitle || 'New Conversation'}
											</span>
											<ChevronDown class="size-3.5 shrink-0 text-white/45" />
										</button>
									{/snippet}
								</Tooltip.Trigger>
								<Tooltip.Content
									class="max-w-xs rounded-md border-0 bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
								>
									<p>{conversationTitle}</p>
								</Tooltip.Content>
							</Tooltip.Root>
						</Tooltip.Provider>
					{:else}
						<button
							type="button"
							class="flex max-w-full cursor-pointer select-none items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white focus:outline-none"
							onclick={openTitleMenu}
						>
							{#if isPinned}
								<MxIcon name="pin-bold" class="size-3.5 shrink-0 rotate-45 text-white/60" />
							{/if}
							<span class="max-w-56 truncate font-medium">
								{isTitleLoading ? 'New Conversation' : conversationTitle || 'New Conversation'}
							</span>
							<ChevronDown class="size-3.5 shrink-0 text-white/45" />
						</button>
					{/if}
				</div>

				<div class="flex justify-end gap-1">
					<Tooltip.Provider delayDuration={100}>
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<button
										{...props}
										type="button"
										class="flex size-8 cursor-pointer select-none items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
										onclick={() => {
											triggerHaptic(15);
											shareConversation();
										}}
										disabled={isShareDisabled}
										aria-label="Share conversation"
									>
										<MxIcon name="share-outline" class="size-4" />
									</button>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content
								class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
							>
								<p>Share Conversation</p>
							</Tooltip.Content>
						</Tooltip.Root>
					</Tooltip.Provider>

					<DropdownMenu.Root>
						<DropdownMenu.Trigger
							class="relative flex size-8 cursor-pointer select-none items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/10 hover:text-white focus:outline-none"
							aria-label="Conversation references"
						>
							<MxIcon name="document-outline" class="size-4" />
							{#if conversationReferences.length > 0}
								<span
									class="absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-[#DB8F5E] text-[9px] font-semibold text-black"
								>
									{conversationReferences.length}
								</span>
							{/if}
						</DropdownMenu.Trigger>
						<DropdownMenu.Content
							align="end"
							class="w-72 border-white/10 bg-[#232323] p-1 text-white"
						>
							<div class="px-2.5 py-2 text-xs font-medium text-white/45">
								Conversation references
							</div>
							{#if conversationReferences.length === 0}
								<div class="px-2.5 py-3 text-xs text-white/35">
									No references in this conversation.
								</div>
							{:else}
								{#each conversationReferences as reference (reference.id)}
									<DropdownMenu.Item
										class="flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-xs text-white/75 transition-all duration-150 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white active:scale-[0.98]"
										onclick={() => {
											triggerHaptic(15);
											openCitationPreview(reference.id, reference.name, reference.pages ?? []);
										}}
									>
										<MxIcon name="document-outline" class="size-3.5 shrink-0 text-white/50" />
										<span class="min-w-0 flex-1 truncate">{reference.name}</span>
									</DropdownMenu.Item>
								{/each}
							{/if}
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</div>
			</div>
		</div>

		{#if !citationPreview && conversationCheckpoints.length > 0}
			<!-- Wide-screen conversation checkpoints -->
			<aside
				class="group/checkpoints pointer-events-auto absolute top-1/2 right-6 z-20 hidden w-4 -translate-y-1/2 xl:block"
				aria-label="Conversation checkpoints"
			>
				<div
					class="flex max-h-[65vh] scrollbar-none flex-col items-center justify-center overflow-y-auto py-2 {conversationCheckpoints.length >
					24
						? 'gap-1'
						: conversationCheckpoints.length > 12
							? 'gap-1.5'
							: 'gap-2.5'}"
				>
					{#each conversationCheckpoints as checkpoint (checkpoint.id)}
						<button
							type="button"
							class="h-0.5 shrink-0 cursor-pointer rounded-full transition-all duration-300 select-none active:scale-95 {checkpoint.id ===
							currentCheckpointId
								? 'w-4.5 bg-[#DB8F5E]'
								: 'w-3 bg-white/25 hover:w-4.5 hover:bg-white/50'}"
							onclick={() => scrollToCheckpoint(checkpoint.id)}
							aria-label={`Jump to checkpoint: ${checkpoint.content}`}
						>
						</button>
					{/each}
				</div>

				<div
					class="pointer-events-none absolute top-1/2 right-0 w-64 translate-x-2 -translate-y-1/2 rounded-2xl border border-white/[0.16] bg-[#232323]/[0.40] p-2 opacity-0 shadow-2xl backdrop-blur-[42px] transition-all duration-300 group-hover/checkpoints:pointer-events-auto group-hover/checkpoints:translate-x-0 group-hover/checkpoints:opacity-100"
				>
					<div class="max-h-64 overflow-y-auto">
						{#each conversationCheckpoints as checkpoint (checkpoint.id)}
							<button
								type="button"
								class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-all duration-150 select-none hover:bg-white/10 active:scale-[0.98] {checkpoint.id ===
								currentCheckpointId
									? 'text-[#E59C6D]'
									: 'text-white/55'}"
								onclick={() => scrollToCheckpoint(checkpoint.id)}
							>
								<span class="min-w-0 flex-1 truncate">{checkpoint.content}</span>
								<span
									class="h-0.5 w-3 shrink-0 rounded-full {checkpoint.id === currentCheckpointId
										? 'bg-[#DB8F5E]'
										: 'bg-white/20'}"
								></span>
							</button>
						{/each}
					</div>
				</div>
			</aside>
		{/if}

		<!-- Center Scrollable Chat Area -->
		<div
			bind:this={chatContainer}
			onscroll={updateActiveCheckpoint}
			class="relative z-10 flex min-h-0 flex-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent flex-col overflow-y-auto px-4 pt-24 md:px-8 md:pt-28"
		>
			<div class="mx-auto flex w-full max-w-4xl flex-col space-y-6 pb-28">
				{#each messages as msg, msgIndex (msg.id)}
					{#if msg.role === 'user'}
						<!-- User Message (Clean Pill) -->
						<div id={`chat-message-${msg.id}`} class="flex w-full justify-end">
							<div
								class="flex max-w-[85%] flex-col items-end gap-1.5 md:max-w-[70%] {editingMessageId ===
								msg.id
									? 'w-full'
									: ''}"
							>
								{#if !(editingMessageId === msg.id) && msg.attachments && msg.attachments.length > 0}
									<AttachmentCards
										attachments={msg.attachments.map((a) => ({
											name: a.name,
											documentId: a.documentId
										}))}
										interactive
										onPreview={(documentId, name) => openCitationPreview(documentId, name, [])}
									/>
								{/if}
								<div
									class="rounded-2xl border border-white/15 bg-[#2B2A29] px-4 py-3 text-sm text-white/90 shadow-md backdrop-blur-md {editingMessageId ===
									msg.id
										? 'w-full'
										: 'w-fit'} {pulseCheckpointId === msg.id ? 'checkpoint-pulse' : ''}"
								>
									{#if editingMessageId === msg.id}
										<textarea
											bind:this={editingTextInput}
											bind:value={editingMessageValue}
											rows={1}
											maxlength={690}
											class="min-h-20 w-full resize-none overflow-hidden rounded-md border border-white/20 bg-black/20 p-2 text-sm text-white outline-none"
											aria-label="Edit question"
											oninput={() => {
												if (editingMessageValue.length > 690) {
													editingMessageValue = editingMessageValue.slice(0, 690);
												}
												resizeEditingTextInput();
											}}
										></textarea>
										<div class="mt-2 flex items-center justify-between gap-2">
											<div
												class="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] select-none {mentionStrippedLength(
													editingMessageValue
												) >= 690
													? 'text-red-400'
													: 'text-white/40'}"
											>
												<MxIcon
													name={mentionStrippedLength(editingMessageValue) >= 690
														? 'devices-keyboard-bold'
														: 'devices-keyboard-outline'}
													class="size-3"
												/>
												<span>{mentionStrippedLength(editingMessageValue)}/690</span>
											</div>
											<div class="flex justify-end gap-2">
												<Button
													variant="ghost"
													size="sm"
													class="cursor-pointer text-xs text-white/70 transition-all duration-150 select-none hover:bg-white/10 hover:text-white focus:outline-none active:scale-[0.95]"
													onclick={cancelEditMessage}>Cancel</Button
												>
												<Button
													size="sm"
													class="cursor-pointer border border-white/20 bg-white/15 text-xs font-medium text-white transition-all duration-150 select-none hover:bg-white/25 hover:text-white focus:outline-none active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-40"
													disabled={mentionStrippedLength(editingMessageValue.trim()) === 0}
													onclick={() => saveEditMessage(msg)}>Save &amp; resubmit</Button
												>
											</div>
										</div>
									{:else}
										<p class="leading-relaxed whitespace-pre-wrap">
											{#each splitMentionSegments(msg.content) as seg, i}
												{#if seg.type === 'mention' && seg.id}
													<button
														type="button"
														class="inline-flex cursor-pointer items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 align-baseline text-[11px] leading-none font-medium text-white/80 transition-all duration-150 select-none hover:border-white/30 hover:bg-white/20 hover:text-white active:scale-[0.95]"
														title="Open {seg.title} in PDF viewer"
														onclick={() => {
															triggerHaptic(15);
															openCitationPreview(seg.id!, seg.title ?? 'Document', []);
														}}
													>
														<MxIcon name="document-outline" class="size-3 text-white/60" />
														{seg.title}
													</button>
												{:else}
													<span>{seg.text}</span>
												{/if}
											{/each}
										</p>
									{/if}
								</div>

								<!-- Action Toolbar for User Question (Copy & Edit) -->
								{#if !(msg.id === lastUserMsgId && isGenerating) && messages[msgIndex + 1]?.status !== 'awaiting_indexing'}
									<div class="flex items-center gap-1">
										<Tooltip.Provider delayDuration={100}>
											<Tooltip.Root>
												<Tooltip.Trigger>
													{#snippet child({ props })}
														<Button
															{...props}
															variant="ghost"
															size="icon"
															class="h-6 w-6 cursor-pointer text-white/40 transition-all duration-150 select-none hover:bg-white/10 hover:text-white active:scale-[0.88]"
															onclick={() => copyToClipboard(msg.content, msg.id)}
															aria-label="Copy question"
														>
															{#if copiedMessageId === msg.id}
																<Check class="size-3 text-green-400" />
															{:else}
																<Copy class="size-3" />
															{/if}
														</Button>
													{/snippet}
												</Tooltip.Trigger>
												<Tooltip.Content
													class="rounded-md border-0 bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
												>
													<p>{copiedMessageId === msg.id ? 'Copied!' : 'Copy question'}</p>
												</Tooltip.Content>
											</Tooltip.Root>
										</Tooltip.Provider>
										{#if msg.id === lastUserMsgId && messages[msgIndex + 1]?.status !== 'awaiting_indexing'}
											<Tooltip.Provider delayDuration={100}>
												<Tooltip.Root>
													<Tooltip.Trigger>
														{#snippet child({ props })}
															<Button
																{...props}
																variant="ghost"
																size="icon"
																class="h-6 w-6 cursor-pointer text-white/40 transition-all duration-150 select-none hover:bg-white/10 hover:text-white active:scale-[0.88]"
																onclick={() => beginEditMessage(msg)}
																aria-label="Edit question"
															>
																<MxIcon name="edit2-outline" class="size-3" />
															</Button>
														{/snippet}
													</Tooltip.Trigger>
													<Tooltip.Content
														class="rounded-md border-0 bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
													>
														<p>Edit question</p>
													</Tooltip.Content>
												</Tooltip.Root>
											</Tooltip.Provider>
										{/if}
									</div>
								{/if}
							</div>
						</div>
					{:else}
						<!-- Assistant Response (Flat & Clean, No Card Bubble, No Avatar, No Timestamps) -->
						<div class="flex w-full justify-start py-2">
							<div class="flex w-full flex-col gap-3">
								<!-- Markdown Content View -->
								<div
									role="none"
									class="prose prose-sm max-w-none text-white/90 prose-invert prose-headings:font-semibold prose-headings:text-white prose-p:leading-relaxed prose-a:text-white/90 prose-a:underline hover:prose-a:text-white prose-code:rounded prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-white/90 prose-code:before:content-none prose-code:after:content-none prose-pre:my-3 prose-pre:border prose-pre:border-white/10 prose-pre:bg-black/50 prose-li:my-1 prose-tr:border-b prose-tr:border-white/10 prose-th:border-b prose-th:border-white/20 prose-td:border-b prose-td:border-white/10 prose-hr:my-4 prose-hr:border-white/10"
									onclick={(e) => {
										const target = e.target as HTMLElement;
										const chip = target.closest('[data-doc-id]');
										if (chip) {
											const docId = chip.getAttribute('data-doc-id') || '';
											const docTitle = chip.getAttribute('data-doc-title') || '';
											const pagesRaw = chip.getAttribute('data-pages') || '';
											const pages = pagesRaw ? pagesRaw.split(',').map(Number).filter(Boolean) : [];
											openCitationPreview(docId, docTitle, pages);
										}
									}}
									onkeydown={() => {}}
								>
									{#if displayedContentOf(msg)}
										{@html renderMarkdown(displayedContentOf(msg), displayedRefsOf(msg))}
									{:else if msg.status === 'awaiting_indexing'}
										<div
											class="flex animate-pulse items-center gap-2 py-1 text-xs font-medium text-white/60 italic select-none"
										>
											<svg class="size-6 shrink-0 text-white/70" viewBox="0 0 50 50">
												<g transform="rotate(0 25 25)">
													<line
														x1="25"
														y1="15"
														x2="25"
														y2="35"
														stroke="currentColor"
														stroke-width="1"
														><animate
															attributeName="strokeWidth"
															values="0.5;2;0.5"
															dur="1s"
															begin="0s"
															repeatCount="indefinite"
														/></line
													>
													<circle cx="25" cy="15" r="2" fill="currentColor"
														><animate
															attributeName="cy"
															values="15;35;15"
															dur="1s"
															begin="0s"
															repeatCount="indefinite"
														/></circle
													>
												</g>
												<g transform="rotate(60 25 25)">
													<line
														x1="25"
														y1="15"
														x2="25"
														y2="35"
														stroke="currentColor"
														stroke-width="1"
														><animate
															attributeName="strokeWidth"
															values="0.5;2;0.5"
															dur="1s"
															begin="0.2s"
															repeatCount="indefinite"
														/></line
													>
													<circle cx="25" cy="15" r="2" fill="currentColor"
														><animate
															attributeName="cy"
															values="15;35;15"
															dur="1s"
															begin="0.2s"
															repeatCount="indefinite"
														/></circle
													>
												</g>
												<g transform="rotate(120 25 25)">
													<line
														x1="25"
														y1="15"
														x2="25"
														y2="35"
														stroke="currentColor"
														stroke-width="1"
														><animate
															attributeName="strokeWidth"
															values="0.5;2;0.5"
															dur="1s"
															begin="0.4s"
															repeatCount="indefinite"
														/></line
													>
													<circle cx="25" cy="15" r="2" fill="currentColor"
														><animate
															attributeName="cy"
															values="15;35;15"
															dur="1s"
															begin="0.4s"
															repeatCount="indefinite"
														/></circle
													>
												</g>
												<g transform="rotate(180 25 25)">
													<line
														x1="25"
														y1="15"
														x2="25"
														y2="35"
														stroke="currentColor"
														stroke-width="1"
														><animate
															attributeName="strokeWidth"
															values="0.5;2;0.5"
															dur="1s"
															begin="0.6s"
															repeatCount="indefinite"
														/></line
													>
													<circle cx="25" cy="15" r="2" fill="currentColor"
														><animate
															attributeName="cy"
															values="15;35;15"
															dur="1s"
															begin="0.6s"
															repeatCount="indefinite"
														/></circle
													>
												</g>
												<g transform="rotate(240 25 25)">
													<line
														x1="25"
														y1="15"
														x2="25"
														y2="35"
														stroke="currentColor"
														stroke-width="1"
														><animate
															attributeName="strokeWidth"
															values="0.5;2;0.5"
															dur="1s"
															begin="0.8s"
															repeatCount="indefinite"
														/></line
													>
													<circle cx="25" cy="15" r="2" fill="currentColor"
														><animate
															attributeName="cy"
															values="15;35;15"
															dur="1s"
															begin="0.8s"
															repeatCount="indefinite"
														/></circle
													>
												</g>
												<g transform="rotate(300 25 25)">
													<line
														x1="25"
														y1="15"
														x2="25"
														y2="35"
														stroke="currentColor"
														stroke-width="1"
														><animate
															attributeName="strokeWidth"
															values="0.5;2;0.5"
															dur="1s"
															begin="1s"
															repeatCount="indefinite"
														/></line
													>
													<circle cx="25" cy="15" r="2" fill="currentColor"
														><animate
															attributeName="cy"
															values="15;35;15"
															dur="1s"
															begin="1s"
															repeatCount="indefinite"
														/></circle
													>
												</g>
											</svg>
											<span>{currentThinkingStatus}</span>
										</div>
									{:else if msg.isStreaming || msg.isRetrying}
										<div
											class="flex animate-pulse items-center gap-2 py-1 text-xs font-medium text-white/60 italic select-none"
										>
											<svg class="size-6 shrink-0 text-white/70" viewBox="0 0 50 50">
												<g transform="rotate(0 25 25)"
													><line
														x1="25"
														y1="15"
														x2="25"
														y2="35"
														stroke="currentColor"
														stroke-width="1"
														><animate
															attributeName="strokeWidth"
															values="0.5;2;0.5"
															dur="1s"
															begin="0s"
															repeatCount="indefinite"
														/></line
													><circle cx="25" cy="15" r="2" fill="currentColor"
														><animate
															attributeName="cy"
															values="15;35;15"
															dur="1s"
															begin="0s"
															repeatCount="indefinite"
														/></circle
													></g
												>
												<g transform="rotate(60 25 25)"
													><line
														x1="25"
														y1="15"
														x2="25"
														y2="35"
														stroke="currentColor"
														stroke-width="1"
														><animate
															attributeName="strokeWidth"
															values="0.5;2;0.5"
															dur="1s"
															begin="0.2s"
															repeatCount="indefinite"
														/></line
													><circle cx="25" cy="15" r="2" fill="currentColor"
														><animate
															attributeName="cy"
															values="15;35;15"
															dur="1s"
															begin="0.2s"
															repeatCount="indefinite"
														/></circle
													></g
												>
												<g transform="rotate(120 25 25)"
													><line
														x1="25"
														y1="15"
														x2="25"
														y2="35"
														stroke="currentColor"
														stroke-width="1"
														><animate
															attributeName="strokeWidth"
															values="0.5;2;0.5"
															dur="1s"
															begin="0.4s"
															repeatCount="indefinite"
														/></line
													><circle cx="25" cy="15" r="2" fill="currentColor"
														><animate
															attributeName="cy"
															values="15;35;15"
															dur="1s"
															begin="0.4s"
															repeatCount="indefinite"
														/></circle
													></g
												>
												<g transform="rotate(180 25 25)"
													><line
														x1="25"
														y1="15"
														x2="25"
														y2="35"
														stroke="currentColor"
														stroke-width="1"
														><animate
															attributeName="strokeWidth"
															values="0.5;2;0.5"
															dur="1s"
															begin="0.6s"
															repeatCount="indefinite"
														/></line
													><circle cx="25" cy="15" r="2" fill="currentColor"
														><animate
															attributeName="cy"
															values="15;35;15"
															dur="1s"
															begin="0.6s"
															repeatCount="indefinite"
														/></circle
													></g
												>
												<g transform="rotate(240 25 25)"
													><line
														x1="25"
														y1="15"
														x2="25"
														y2="35"
														stroke="currentColor"
														stroke-width="1"
														><animate
															attributeName="strokeWidth"
															values="0.5;2;0.5"
															dur="1s"
															begin="0.8s"
															repeatCount="indefinite"
														/></line
													><circle cx="25" cy="15" r="2" fill="currentColor"
														><animate
															attributeName="cy"
															values="15;35;15"
															dur="1s"
															begin="0.8s"
															repeatCount="indefinite"
														/></circle
													></g
												>
												<g transform="rotate(300 25 25)"
													><line
														x1="25"
														y1="15"
														x2="25"
														y2="35"
														stroke="currentColor"
														stroke-width="1"
														><animate
															attributeName="strokeWidth"
															values="0.5;2;0.5"
															dur="1s"
															begin="1s"
															repeatCount="indefinite"
														/></line
													><circle cx="25" cy="15" r="2" fill="currentColor"
														><animate
															attributeName="cy"
															values="15;35;15"
															dur="1s"
															begin="1s"
															repeatCount="indefinite"
														/></circle
													></g
												>
											</svg>
											<span>{currentThinkingStatus}</span>
										</div>
									{/if}
								</div>

								<!-- Terminal Status Marker (stopped / failed / blocked) -->
								<TurnStatusBadge
									status={!msg.isStreaming ? displayedStatusOf(msg) : null}
									detailed
								/>

								{#if speakingMessageId === msg.id}
									<div
										class="mt-2 inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/5 py-1 pr-1.5 pl-3"
									>
										<Volume2 class="size-3.5 shrink-0 animate-pulse text-white/60" />
										<span class="text-xs font-medium text-white/60">Reading aloud…</span>
										<button
											type="button"
											class="flex cursor-pointer items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/80 transition-all duration-150 select-none hover:bg-white/20 hover:text-white focus:outline-none active:scale-95"
											onclick={stopSpeaking}
											aria-label="Stop reading"
										>
											<Square class="size-3" />
											<span>Stop</span>
										</button>
									</div>
								{/if}

								<!-- Document Reference Chips -->
								{#if !msg.isStreaming && !msg.isRetrying && !displayedCancelledOf(msg) && displayedRefsOf(msg).length > 0}
									<SourceReferences
										references={displayedRefsOf(msg)}
										interactive
										onPreview={(ref) =>
											openCitationPreview(ref.id ?? '', ref.name, ref.pages ?? [])}
									/>
								{/if}

								<!-- Action Toolbar (Copy, Retry, Thumbs Up/Down, Dropdown Menu) -->
								{#if !msg.isStreaming && msg.status !== 'awaiting_indexing'}
									<div class="flex items-center justify-between gap-2 pt-1 text-white/40">
										<div class="flex items-center gap-1">
											<Tooltip.Provider delayDuration={100}>
												<Tooltip.Root>
													<Tooltip.Trigger>
														{#snippet child({ props })}
															<Button
																{...props}
																variant="ghost"
																size="icon"
																class="h-7 w-7 cursor-pointer text-white/40 transition-all duration-150 select-none hover:bg-white/10 hover:text-white active:scale-[0.88]"
																onclick={() => copyToClipboard(displayedContentOf(msg), msg.id)}
																aria-label="Copy response"
															>
																{#if copiedMessageId === msg.id}
																	<Check class="size-3.5 text-green-400" />
																{:else}
																	<Copy class="size-3.5" />
																{/if}
															</Button>
														{/snippet}
													</Tooltip.Trigger>
													<Tooltip.Content
														class="rounded-md border-0 bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
													>
														<p>{copiedMessageId === msg.id ? 'Copied!' : 'Copy response'}</p>
													</Tooltip.Content>
												</Tooltip.Root>
											</Tooltip.Provider>

											<Tooltip.Provider delayDuration={100}>
												<Tooltip.Root>
													<Tooltip.Trigger>
														{#snippet child({ props })}
															<Button
																{...props}
																variant="ghost"
																size="icon"
																class="h-7 w-7 cursor-pointer transition-all duration-150 select-none active:scale-[0.88] {msg.feedback ===
																'good'
																	? 'bg-white/10 text-white hover:bg-white/20 hover:text-white'
																	: 'text-white/40 hover:bg-white/10 hover:text-white'}"
																onclick={() => toggleFeedback(msg, 'good')}
																aria-label="Helpful"
															>
																<ThumbsUp class="size-3.5" />
															</Button>
														{/snippet}
													</Tooltip.Trigger>
													<Tooltip.Content
														class="rounded-md border-0 bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
													>
														<p>Good response</p>
													</Tooltip.Content>
												</Tooltip.Root>
											</Tooltip.Provider>

											<Tooltip.Provider delayDuration={100}>
												<Tooltip.Root>
													<Tooltip.Trigger>
														{#snippet child({ props })}
															<Button
																{...props}
																variant="ghost"
																size="icon"
																class="h-7 w-7 cursor-pointer transition-all duration-150 select-none active:scale-[0.88] {msg.feedback ===
																'bad'
																	? 'bg-white/10 text-white hover:bg-white/20 hover:text-white'
																	: 'text-white/40 hover:bg-white/10 hover:text-white'}"
																onclick={() => toggleFeedback(msg, 'bad')}
																aria-label="Not helpful"
															>
																<ThumbsDown class="size-3.5" />
															</Button>
														{/snippet}
													</Tooltip.Trigger>
													<Tooltip.Content
														class="rounded-md border-0 bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
													>
														<p>Bad response</p>
													</Tooltip.Content>
												</Tooltip.Root>
											</Tooltip.Provider>

											{#if !msg.isRejection && msg.status !== 'blocked' && messages[msgIndex - 1]?.role === 'user' && messages[msgIndex - 1]?.id === lastUserMsgId}
												<DropdownMenu.Root>
													<Tooltip.Provider delayDuration={100}>
														<Tooltip.Root>
															<Tooltip.Trigger>
																{#snippet child({ props: tooltipProps })}
																	<DropdownMenu.Trigger>
																		{#snippet child({ props: dropdownProps })}
																			<button
																				{...tooltipProps}
																				{...dropdownProps}
																				type="button"
																				class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-white/40 transition-all duration-150 select-none hover:bg-white/10 hover:text-white active:scale-[0.88]"
																				aria-label="Retry response"
																			>
																				<RotateCw class="size-3.5" />
																			</button>
																		{/snippet}
																	</DropdownMenu.Trigger>
																{/snippet}
															</Tooltip.Trigger>
															<Tooltip.Content
																class="rounded-md border-0 bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
															>
																<p>Regenerate response</p>
															</Tooltip.Content>
														</Tooltip.Root>
													</Tooltip.Provider>
													<DropdownMenu.Content
														align="start"
														class="w-36 border border-white/[0.16] bg-[#232323]/[0.40] p-1 text-white backdrop-blur-[42px]"
													>
														<DropdownMenu.Item
															class="flex cursor-pointer select-none items-center gap-2 rounded-md text-xs text-white/80 transition-all duration-150 hover:bg-white/[0.12] hover:text-white focus:bg-white/[0.16] focus:text-white focus:outline-none active:scale-[0.98]"
															onclick={() => {
																triggerHaptic(20);
																retryMessage(msg, messages[msgIndex - 1]);
															}}
														>
															<RotateCw class="size-3.5 text-white/70" />
															<span>Try Again</span>
														</DropdownMenu.Item>
													</DropdownMenu.Content>
												</DropdownMenu.Root>
											{/if}
											<!-- Triple Dot Response Action Button -->
											<Tooltip.Provider delayDuration={100}>
												<Tooltip.Root>
													<Tooltip.Trigger>
														{#snippet child({ props })}
															<button
																{...props}
																type="button"
																class="flex size-7 cursor-pointer items-center justify-center rounded-md text-white/40 transition-all duration-150 select-none hover:bg-white/10 hover:text-white focus:outline-none active:scale-[0.88]"
																onclick={(e) => openResponseMenu(e, msgIndex)}
																aria-label="More options"
															>
																<MxIcon name="menu-dots-outline" class="size-3.5" />
															</button>
														{/snippet}
													</Tooltip.Trigger>
													<Tooltip.Content
														class="rounded-md border-0 bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
													>
														<p>More options</p>
													</Tooltip.Content>
												</Tooltip.Root>
											</Tooltip.Provider>
										</div>
										{#if msg.variants && msg.variants.length > 0}
											<div
												class="inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-white/5 px-1 py-0.5 text-[11px] font-medium text-white/50 select-none"
											>
												<button
													type="button"
													class="flex size-5 cursor-pointer items-center justify-center rounded-full text-white/50 transition-all duration-150 select-none hover:bg-white/10 hover:text-white active:scale-90 disabled:cursor-not-allowed disabled:opacity-30"
													onclick={() => browseVariant(msg, -1)}
													disabled={isGenerating || (msg.variantIndex ?? 0) <= 0}
													aria-label="Previous response"
												>
													<ChevronLeft class="size-3" />
												</button>
												<span class="px-1.5 text-xs tabular-nums"
													>{(msg.variantIndex ?? 0) + 1} / {(msg.variants?.length ?? 0) + 1}</span
												>
												<button
													type="button"
													class="flex size-5 cursor-pointer items-center justify-center rounded-full text-white/50 transition-all duration-150 select-none hover:bg-white/10 hover:text-white active:scale-90 disabled:cursor-not-allowed disabled:opacity-30"
													onclick={() => browseVariant(msg, 1)}
													disabled={isGenerating ||
														(msg.variantIndex ?? 0) >= (msg.variants?.length ?? 0)}
													aria-label="Next response"
												>
													<ChevronRight class="size-3" />
												</button>
											</div>
										{/if}
									</div>
								{/if}
							</div>
						</div>
					{/if}
					{#if msg.role === 'assistant' && msg.branchedFromTurnId}
						<div class="flex items-center justify-center gap-2 py-2 text-[11px] text-white/40">
							<div class="h-px flex-1 bg-white/10"></div>
							<GitBranch class="size-3 shrink-0" />
							<span class="flex items-center gap-1">
								Branched from
								{#if branchOfTitle}
									<a
										href={`/app/chat/${branchOfId ?? ''}`}
										class="cursor-pointer underline decoration-white/30 underline-offset-2 hover:text-white hover:decoration-white/70"
										>{branchOfTitle}</a
									>
								{:else}
									Deleted Conversation
								{/if}
							</span>
							<div class="h-px flex-1 bg-white/10"></div>
						</div>
					{/if}
				{/each}
			</div>
		</div>

		<!-- Bottom Area: Floating Input Capsule -->
		<div
			class="pointer-events-none absolute right-0 bottom-0 left-0 z-30 flex flex-col items-center justify-end bg-gradient-to-t from-[#1F1E1D] via-[#1F1E1D]/85 via-50% to-transparent pt-10 pb-4"
			style="font-family: 'Inter', sans-serif;"
		>
			<div class="pointer-events-auto flex w-full max-w-4xl flex-col items-center gap-3 px-4">
				<!-- Main Input Capsule (reusable ChatInput) -->
				<ChatInput
					bind:value={inputValue}
					bind:attachedFiles
					bind:selectedModel
					{llmOptions}
					placeholder="Ask a follow-up, or type @ to mention documents..."
					transparent
					{isGenerating}
					isUploading={isUploadingAttachments}
					{baseUploads}
					{maxUploads}
					{baseStorage}
					{maxStorage}
					{maxFileSizeBytes}
					onsend={handleSendMessage}
					onstop={stopCurrentStream}
					onconfigure={() => openConfigureDialog()}
				/>

				<!-- Lower Row: Disclaimer & Counter
				     Fixed h-8: mirrors the mode-toggle row on /app/chat so the
				     ChatInput capsule keeps the same bottom offset on both pages
				     (no visual jump on page transition). -->
				<div class="flex h-8 w-full items-center justify-between px-2 text-xs text-white/40">
					<p class="text-[11px] text-white/40 select-none">
						Dokyudo can make mistakes. Check again the source references document.
					</p>

					<!-- Keyboard length counter -->
					<div
						class="flex shrink-0 select-none items-center gap-1.5 rounded-full border border-white/[0.16] bg-[#232323]/[0.40] px-3 py-1.5 text-xs backdrop-blur-[42px] transition-colors {mentionStrippedLength(
							inputValue
						) >= 690
							? 'text-red-400'
							: 'text-white/[0.40]'}"
					>
						<MxIcon
							name={mentionStrippedLength(inputValue) >= 690
								? 'devices-keyboard-bold'
								: 'devices-keyboard-outline'}
							class="size-3.5"
						/>
						<span class="font-medium">{mentionStrippedLength(inputValue)}/690</span>
					</div>
				</div>
			</div>
		</div>
	</div>
{/snippet}

<EditTitleDialog
	bind:open={isTitleEditDialogOpen}
	title={conversationTitle}
	isSaving={isTitleSaving}
	onSave={saveConversationTitle}
	onClose={() => (isTitleEditDialogOpen = false)}
/>

<ConfirmDeleteDialog
	bind:open={isDeleteConversationDialogOpen}
	title="Delete"
	itemName={conversationTitle}
	description="This will permanently delete this conversation and its history."
	confirmLabel="Delete conversation"
	isDeleting={isConversationDeleting}
	onConfirm={deleteCurrentConversation}
	onClose={() => (isDeleteConversationDialogOpen = false)}
/>

<ShareConversationDialog
	bind:open={isShareDialogOpen}
	conversationId={chatId}
	{conversationTitle}
	onClose={() => (isShareDialogOpen = false)}
/>

<Dialog.Root bind:open={isDeleteResponseDialogOpen}>
	<Dialog.Content
		class="border border-white/[0.16] bg-[#232323]/[0.40] text-white backdrop-blur-[42px] sm:max-w-md"
	>
		<Dialog.Header>
			<Dialog.Title class="text-lg font-semibold text-white">Delete response?</Dialog.Title>
			<Dialog.Description class="text-sm text-white/45">
				This will permanently remove this response turn from the conversation.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="mt-1 flex gap-2 sm:justify-end">
			<Button
				variant="ghost"
				class="cursor-pointer text-white/60 hover:bg-white/10 hover:text-white"
				disabled={isResponseDeleting}
				onclick={() => (isDeleteResponseDialogOpen = false)}
			>
				Cancel
			</Button>
			<Button
				class="cursor-pointer bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
				disabled={isResponseDeleting}
				onclick={confirmDeleteResponse}
			>
				{#if isResponseDeleting}
					<Spinner class="mr-2" />
					Deleting...
				{:else}
					Delete response
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

{#if isTitleMenuOpen}
	<!-- Backdrop to capture click outside -->
	<div
		role="presentation"
		class="fixed inset-0 z-50 bg-transparent"
		onclick={() => (isTitleMenuOpen = false)}
		onkeydown={() => (isTitleMenuOpen = false)}
	></div>

	<!-- Cursor Positioned Floating Menu -->
	<div
		transition:scale={{ duration: 150, start: 0.95 }}
		style={`position: fixed; top: ${titleMenuPos.y + 8}px; left: ${Math.min(Math.max(16, titleMenuPos.x - 96), window.innerWidth - 208)}px;`}
		class="z-50 w-48 rounded-2xl border border-white/[0.16] bg-[#232323]/[0.40] p-1 text-white shadow-2xl backdrop-blur-[42px]"
	>
		<button
			type="button"
			class="flex w-full cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-all duration-150 hover:bg-white/[0.12] hover:text-white active:scale-[0.98]"
			onclick={() => {
				triggerHaptic(15);
				isTitleMenuOpen = false;
				openTitleEditDialog();
			}}
		>
			<MxIcon name="edit2-outline" class="size-3.5 text-white/60" />
			<span>Edit title</span>
		</button>
		<button
			type="button"
			class="flex w-full cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-all duration-150 hover:bg-white/[0.12] hover:text-white active:scale-[0.98]"
			onclick={() => {
				triggerHaptic(15);
				togglePinConversation();
			}}
		>
			{#if isPinned}
				<MxIcon name="pin-bold" class="size-3.5 text-white/60" />
				<span>Unpin conversation</span>
			{:else}
				<MxIcon name="pin-outline" class="size-3.5 text-white/60" />
				<span>Pin conversation</span>
			{/if}
		</button>
		<div class="my-1 h-px bg-white/[0.16]"></div>
		<button
			type="button"
			class="flex w-full cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-red-400 transition-all duration-150 hover:bg-red-500/10 hover:text-red-300 focus:bg-red-500/10 focus:text-red-300 focus:outline-none active:scale-[0.98] active:bg-red-500/15"
			onclick={() => {
				triggerHaptic(15);
				isTitleMenuOpen = false;
				isDeleteConversationDialogOpen = true;
			}}
		>
			<MxIcon name="trash-bin-minimalistic-outline" class="size-3.5 shrink-0 text-red-400" />
			<span>Delete conversation</span>
		</button>
	</div>
{/if}

{#if activeResponseMenuMsgIndex !== null}
	<!-- Backdrop to capture click outside -->
	<div
		role="presentation"
		class="fixed inset-0 z-50 bg-transparent"
		onclick={closeResponseMenu}
		onkeydown={closeResponseMenu}
	></div>

	<!-- Custom AI Response Action Floating Menu -->
	<div
		transition:scale={{ duration: 150, start: 0.95 }}
		style={`position: fixed; top: ${responseMenuPos.y + 6}px; left: ${Math.min(Math.max(16, responseMenuPos.x), window.innerWidth - 208)}px;`}
		class="z-50 w-48 rounded-2xl border border-white/[0.16] bg-[#232323]/[0.40] p-1 text-white shadow-2xl backdrop-blur-[42px]"
	>
		<button
			type="button"
			class="flex w-full cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-all duration-150 hover:bg-white/[0.12] hover:text-white active:scale-[0.98]"
			onclick={() => {
				triggerHaptic(15);
				branchFromMessage(activeResponseMenuMsgIndex!);
			}}
		>
			<GitBranch class="size-3.5 text-white/70" />
			<span>Branch in new chat</span>
		</button>
		<button
			type="button"
			class="flex w-full cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-all duration-150 hover:bg-white/[0.12] hover:text-white active:scale-[0.98]"
			onclick={() => {
				triggerHaptic(15);
				const msgIndex = activeResponseMenuMsgIndex;
				closeResponseMenu();
				if (msgIndex !== null) toggleReadAloud(msgIndex);
			}}
		>
			<Volume2 class="size-3.5 text-white/70" />
			<span
				>{speakingMessageId === messages[activeResponseMenuMsgIndex!]?.id
					? 'Stop reading'
					: 'Read aloud'}</span
			>
		</button>
		<div class="my-1 h-px bg-white/[0.16]"></div>
		<button
			type="button"
			class="flex w-full cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-red-400 transition-all duration-150 hover:bg-red-500/10 hover:text-red-300 focus:bg-red-500/10 focus:text-red-300 focus:outline-none active:scale-[0.98] active:bg-red-500/15"
			disabled={messages[activeResponseMenuMsgIndex]?.isStreaming}
			onclick={() => {
				triggerHaptic(15);
				if (activeResponseMenuMsgIndex !== null) {
					openDeleteResponseDialog(activeResponseMenuMsgIndex);
				}
				closeResponseMenu();
			}}
		>
			<MxIcon name="trash-bin-minimalistic-outline" class="size-3.5 shrink-0 text-red-400" />
			<span>Delete response</span>
		</button>
	</div>
{/if}

<style>
	@keyframes checkpoint-pulse {
		0% {
			box-shadow: 0 0 0 0 rgb(255 255 255 / 0%);
			transform: scale(1);
		}
		35% {
			box-shadow: 0 0 0 5px rgb(255 255 255 / 12%);
			transform: scale(1.015);
		}
		100% {
			box-shadow: 0 0 0 0 rgb(255 255 255 / 0%);
			transform: scale(1);
		}
	}

	.checkpoint-pulse {
		animation: checkpoint-pulse 900ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	:global(.prose table) {
		border-collapse: collapse;
		width: 100%;
		margin-top: 1rem;
		margin-bottom: 1rem;
	}
	:global(.prose th) {
		border-bottom: 1px solid rgba(255, 255, 255, 0.2) !important;
		padding: 0.625rem 0.875rem;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.95);
	}
	:global(.prose td) {
		border-bottom: 1px solid rgba(255, 255, 255, 0.12) !important;
		padding: 0.625rem 0.875rem;
		color: rgba(255, 255, 255, 0.85);
	}
	:global(.prose tr:hover) {
		background-color: rgba(255, 255, 255, 0.03);
	}
	:global(.prose hr) {
		border-top: 1px solid rgba(255, 255, 255, 0.12) !important;
		border-bottom: none !important;
		margin-top: 1.25rem;
		margin-bottom: 1.25rem;
	}

	:global(button),
	:global(a) {
		-webkit-tap-highlight-color: rgba(255, 255, 255, 0.08);
		-webkit-touch-callout: none;
		touch-action: manipulation;
	}
</style>
