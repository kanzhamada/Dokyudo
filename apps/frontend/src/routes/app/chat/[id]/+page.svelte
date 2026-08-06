<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { slide } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		Paperclip,
		SendHorizontal,
		MessageSquare,
		Search,
		ChevronDown,
		Keyboard,
		X,
		ArrowLeft,
		Sparkles,
		FileText,
		Copy,
		Check,
		ThumbsUp,
		ThumbsDown,
		BookOpen,
		Ellipsis,
		GitBranch,
		Volume2,
		Pencil,
		RotateCw,
		Square,
		Trash2,
		Settings2,
		KeyRound,
		Plus,
		Share2,
		Menu
	} from 'lucide-svelte';

	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Dialog from '$lib/components/ui/dialog';
	import { useSidebar } from '$lib/components/ui/sidebar';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Resizable from '$lib/components/ui/resizable';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { toast } from 'svelte-sonner';
	import { mobileHeaderState } from '$lib/state/mobile-header.svelte.js';
	import { getMeUsage } from '$lib/api/me';
	import { deleteKey, getKeys, upsertKey } from '$lib/api/keys';
	import { deleteConversation, getConversation, updateConversation } from '$lib/api/rag';
	import { TIER_LIMITS, type TierType } from '$lib/constants/tiers.constant';
	import { PUBLIC_API_URL } from '$env/static/public';
	import { dokyudoFetch } from '$lib/apiClient';
	import { apiRequest } from '$lib/api/client';
	import { sessionStore } from '$lib/state/session.store.svelte';
	import { conversationsStore } from '$lib/state/conversations.store.svelte';
	import PdfPreviewPanel from '$lib/components/app/PdfPreviewPanel.svelte';
	import { mergeConversationReferences, type DocReference } from '$lib/utils/doc-references';
	import { marked } from 'marked';

	marked.setOptions({
		gfm: true,
		breaks: true
	});

	function formatPageNumbers(raw: string): string {
		if (!raw) return '';
		const expanded = raw.replace(/(\d+)\s*-\s*(\d+)/g, (_m, startStr, endStr) => {
			const start = Number(startStr);
			const end = Number(endStr);
			if (end > start && end - start < 30) {
				const arr: number[] = [];
				for (let i = start; i <= end; i++) {
					arr.push(i);
				}
				return arr.join(', ');
			}
			return `${startStr}, ${endStr}`;
		});

		const matches = expanded.match(/\d+/g);
		if (!matches || matches.length === 0) return raw.trim();

		const uniqueNums = Array.from(new Set(matches.map(Number))).sort((a, b) => a - b);
		return uniqueNums.join(', ');
	}

	function transformCitationTags(html: string, references?: DocReference[]): string {
		if (!html) return '';

		const isNegativeAnswer = /(Mohon maaf|tidak mengandung informasi|tidak ditemukan|tidak ada informasi|does not contain|cannot answer|no information available)/i.test(html);
		if (isNegativeAnswer) {
			return html.replace(/\s*\[Doc [^\]]+\]/gi, '');
		}

		let cleanHtml = html.replace(/\[Doc \d+:[^\]]*;[^\]]*\]/gi, '');

		let result = cleanHtml.replace(/\[Doc (\d+)(?::\s*(?:Hlm\.|Pages?|Page)?\s*([^\]]+))?\]/gi, (_match, docIdxStr, rawPageInfo) => {
			const docIdx = Number(docIdxStr);
			let docDisplayName = `Doc ${docIdx}`;
			let tooltipTitle = `Doc ${docIdx}`;
			let docId = '';
			let docFullName = '';

			if (references && references.length > 0) {
				const refDoc = references.find((r) => r.index === docIdx || r.id === docIdxStr) || references[docIdx - 1];
					if (refDoc && refDoc.name) {
						docId = refDoc.id;
						docFullName = refDoc.name;
						tooltipTitle = refDoc.name;
						const cleanName = refDoc.name.replace(/\.[^/.]+$/, '');
						docDisplayName = cleanName.length > 20 ? cleanName.slice(0, 20) + '...' : cleanName;
					}
				}

				const pageFormatted = rawPageInfo ? formatPageNumbers(rawPageInfo) : '';
				const label = pageFormatted ? `${docDisplayName} • ${pageFormatted}` : docDisplayName;
				return `<span data-doc-id="${docId}" data-doc-title="${docFullName}" data-pages="${pageFormatted}" class="inline-flex cursor-pointer items-center gap-1 truncate rounded-full border border-white/15 bg-[#2B2A29] px-2.5 py-0.5 text-[11px] font-medium text-white/80 transition-colors hover:border-white/30 hover:bg-[#383736] hover:text-white" style="max-width: 180px;" title="${tooltipTitle}">${label}</span>`;
			}
		);

		return result.replace(/\s*\[Doc [^\]]+\]/gi, '');
	}

	function renderMarkdown(text: string, references?: DocReference[]): string {
		if (!text) return '';
		try {
			const rawHtml = marked.parse(text) as string;
			return transformCitationTags(rawHtml, references);
		} catch (e) {
			return text;
		}
	}

	import claudeIcon from '$lib/assets/llm/claude.svg';
	import cohereIcon from '$lib/assets/llm/cohere.svg';
	import geminiIcon from '$lib/assets/llm/gemini.svg';
	import groqIcon from '$lib/assets/llm/groq.svg';
	import metaIcon from '$lib/assets/llm/meta.svg';
	import mistralIcon from '$lib/assets/llm/mistral.svg';
	import openaiIcon from '$lib/assets/llm/openai.svg';
	import openrouterIcon from '$lib/assets/llm/openrouter.svg';

	interface LlmOption {
		name: string;
		provider: string;
		model: string;
		icon: string;
	}

	type ByokProvider = 'gemini' | 'mistral' | 'openrouter';

	interface ByokProviderOption {
		id: ByokProvider;
		label: string;
		description: string;
		icon: string;
		placeholder: string;
	}

	interface ChatMessage {
		id: string;
		role: 'user' | 'assistant';
		content: string;
		timestamp: string;
		modelName?: string;
		attachments?: { name: string; size?: number }[];
		references?: DocReference[];
		isStreaming?: boolean;
		isCancelled?: boolean;
		isRejection?: boolean;
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
		{ name: 'Free Auto', provider: 'auto', model: 'auto', icon: geminiIcon }
	];

	const BYOK_PROVIDER_OPTIONS: ByokProviderOption[] = [
		{
			id: 'gemini',
			label: 'Google AI',
			description: 'Gemini models',
			icon: geminiIcon,
			placeholder: 'AIza...'
		},
		{
			id: 'mistral',
			label: 'Mistral',
			description: 'Mistral models',
			icon: mistralIcon,
			placeholder: 'Mistral API key'
		},
		{
			id: 'openrouter',
			label: 'OpenRouter',
			description: 'Access more models',
			icon: openrouterIcon,
			placeholder: 'sk-or-v1-...'
		}
	];

	// UI & Transition State
	let isMounted = $state(false);
	let activeMode = $state('chat');
	let fileInput: HTMLInputElement | null = $state(null);
	let textInput: HTMLTextAreaElement | null = $state(null);
	let chatContainer: HTMLDivElement | null = $state(null);
	let inputValue = $state('');
	let llmOptions: LlmOption[] = $state(INITIAL_LLM_OPTIONS);
	let selectedModel: LlmOption = $state(INITIAL_LLM_OPTIONS[0]);
	let attachedFiles: File[] = $state([]);
	let copiedMessageId: string | null = $state(null);
	let isGenerating = $state(false);
	let editingMessageId = $state<string | null>(null);
	let editingMessageValue = $state('');
	let editingTextInput: HTMLTextAreaElement | null = $state(null);
	let activeAbortController: AbortController | null = null;
	let cancelActiveStream: (() => void) | null = null;
	let activeStreamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
	const sidebar = useSidebar();
	let isTitleEditDialogOpen = $state(false);
	let titleDraft = $state('');
	let isTitleSaving = $state(false);
	let isDeleteConversationDialogOpen = $state(false);
	let isConversationDeleting = $state(false);
	let isMobileReferencesOpen = $state(false);
	let isMobileTitleActionsOpen = $state(false);
	let pulseCheckpointId = $state<string | null>(null);
	let pulseCheckpointTimeout: ReturnType<typeof setTimeout> | null = null;
	let checkpointVisibilityTimeout: ReturnType<typeof setTimeout> | null = null;
	let isConfigureDialogOpen = $state(false);
	let configureProvider = $state<ByokProvider>('gemini');
	let configureApiKey = $state('');
	let isSavingKey = $state(false);
	let isResettingKey = $state(false);
	let configureError = $state('');
	let modelSearchQuery = $state('');
	let configuredKeyMasks = $state<Record<ByokProvider, string>>({
		gemini: '',
		mistral: '',
		openrouter: ''
	});

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

	let currentThinkingStatus = $state(THINKING_STATUS_MESSAGES[0]);
	let thinkingTimer: ReturnType<typeof setInterval> | null = null;

	function startThinkingTimer() {
		if (thinkingTimer) clearInterval(thinkingTimer);
		const getRandomStatus = () =>
			THINKING_STATUS_MESSAGES[Math.floor(Math.random() * THINKING_STATUS_MESSAGES.length)];
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
		cancelActiveStream?.();
		stopThinkingTimer();
		if (pulseCheckpointTimeout) clearTimeout(pulseCheckpointTimeout);
		if (checkpointVisibilityTimeout) clearTimeout(checkpointVisibilityTimeout);
	});

	// Auto-reset textarea height when input is cleared
	$effect(() => {
		if (!inputValue && textInput) {
			textInput.style.height = 'auto';
		}
	});

	// Conversation metadata
	let chatId = $derived(page.params.id || 'chat-default');
	let conversationTitle = $state('New Conversation');
	let isTitleLoading = $state(false);

	// Conversation Messages
	let messages: ChatMessage[] = $state([]);
	let conversationCheckpoints = $derived(
		messages.filter((message) => message.role === 'user')
	);
	let conversationRequestId = 0;

	// Track the last user message id for edit button visibility
	let lastUserMsgId = $derived([...messages].reverse().find((m) => m.role === 'user')?.id ?? null);
	let activeCheckpointId = $state<string | null>(null);
	let currentCheckpointId = $derived(activeCheckpointId ?? lastUserMsgId);

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

	// Derived UI states
	let currentUploadCount = $derived(baseUploads + attachedFiles.length);
	let currentStorageBytes = $derived(
		baseStorage + attachedFiles.reduce((acc, file) => acc + file.size, 0)
	);

	let maxFileSizeMB = $derived((maxFileSizeBytes / (1024 * 1024)).toFixed(0));

	async function loadConversation(id: string) {
		const requestId = ++conversationRequestId;
		cancelActiveStream?.();
		messages = [];
		conversationTitle = 'New Conversation';
		inputValue = '';
		attachedFiles = [];

		try {
			console.log(`[Chat Detail] Fetching conversation history for ID: ${id}`);
			const convRes = await getConversation(id);
			if (requestId !== conversationRequestId) return;
			if (convRes.ok) {
				if (convRes.data.title) conversationTitle = convRes.data.title;
				if (convRes.data.turns && convRes.data.turns.length > 0) {
					const historyMsgs: ChatMessage[] = [];
					for (const turn of convRes.data.turns) {
						historyMsgs.push({
							id: `${turn.id}-user`,
							role: 'user',
							content: turn.question,
							timestamp: new Date(turn.createdAt).toLocaleTimeString([], {
								hour: '2-digit',
								minute: '2-digit'
							})
						});
						historyMsgs.push({
							id: `${turn.id}-asst`,
							role: 'assistant',
							modelName: turn.modelUsed || undefined,
							content: turn.answer,
							timestamp: new Date(turn.createdAt).toLocaleTimeString([], {
								hour: '2-digit',
								minute: '2-digit'
							}),
							references: turn.contextReferences?.map((r: any) => ({
								id: r.documentId,
								index: r.index || 1,
								name: r.title || r.documentId,
								pages: r.pages
							})),
							isStreaming: false
						});
					}
					messages = historyMsgs;
				}
			} else if (convRes.error.code === 'NOT_FOUND') {
				console.log('[Chat Detail] New conversation initialized (no history in DB yet).');
			}
		} catch (err) {
			if (requestId === conversationRequestId)
				console.error('[Chat Detail] Failed to load conversation:', err);
			return;
		}

		const stateObj =
			((page as any)?.state as any) || (history.state as any)?.usr || (history.state as any);
		if (requestId === conversationRequestId && stateObj?.initialQuestion) {
			isTitleLoading = true;
			const initialQ = stateObj.initialQuestion as string;
			const initialModel = (stateObj.selectedModel as LlmOption) || selectedModel;
			if (stateObj.selectedModel) selectedModel = stateObj.selectedModel as LlmOption;
			streamChatTurn(initialQ, initialModel);
		}
		scrollToBottom();
	}

	$effect(() => {
		loadConversation(chatId);
	});

	function isByokProvider(provider: string): provider is ByokProvider {
		return provider === 'gemini' || provider === 'mistral' || provider === 'openrouter';
	}

	async function loadLlmOptions() {
		try {
			const keysRes = await getKeys();
			if (!keysRes.ok) return;

			const dynamicOptions: LlmOption[] = [...INITIAL_LLM_OPTIONS];
			const nextMasks: Record<ByokProvider, string> = {
				gemini: '',
				mistral: '',
				openrouter: ''
			};

			for (const item of keysRes.data.data ?? []) {
				const provider = item.provider.toLowerCase();
				if (!isByokProvider(provider)) continue;

				nextMasks[provider] = item.maskedKey;
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
			configuredKeyMasks = nextMasks;
			selectedModel =
				dynamicOptions.find((option) => `${option.provider}:${option.model}` === selectedKey) ??
				dynamicOptions[0];
		} catch (err) {
			console.error('[Chat Detail] Failed to fetch BYOK keys:', err);
		}
	}

	function openConfigureDialog(provider: ByokProvider = configureProvider) {
		modelSearchQuery = '';
		configureProvider = provider;
		configureApiKey = '';
		configureError = '';
		isConfigureDialogOpen = true;
	}

	function openTitleEditDialog() {
		titleDraft = conversationTitle === 'New Conversation' ? '' : conversationTitle;
		isTitleEditDialogOpen = true;
	}

	async function saveConversationTitle() {
		const nextTitle = titleDraft.trim();
		if (!nextTitle || isTitleSaving) return;

		isTitleSaving = true;
		try {
			const result = await updateConversation(chatId, { title: nextTitle });
			if (!result.ok) {
				toast.error(result.error.message);
				return;
			}

			conversationTitle = nextTitle;
			conversationsStore.addOrUpdate(chatId, nextTitle);
			isTitleEditDialogOpen = false;
			toast.success('Conversation title updated');
		} catch (err) {
			console.error('[Chat Detail] Failed to update conversation title:', err);
			toast.error('Failed to update conversation title');
		} finally {
			isTitleSaving = false;
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
			await goto('/app/chat');
		} catch (err) {
			console.error('[Chat Detail] Failed to delete conversation:', err);
			toast.error('Failed to delete conversation');
		} finally {
			isConversationDeleting = false;
		}
	}

	async function shareConversation() {
		try {
			await navigator.clipboard.writeText(window.location.href);
			toast.success('Conversation link copied');
		} catch {
			toast.error('Unable to copy conversation link');
		}
	}

	function scrollToCheckpoint(messageId: string) {
		activeCheckpointId = messageId;
		if (pulseCheckpointTimeout) clearTimeout(pulseCheckpointTimeout);
		if (checkpointVisibilityTimeout) clearTimeout(checkpointVisibilityTimeout);
		document.getElementById(`chat-message-${messageId}`)?.scrollIntoView({
			behavior: 'smooth',
			block: 'center'
		});
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
	}

	function toggleMobileTitleActions() {
		isMobileTitleActionsOpen = !isMobileTitleActionsOpen;
		isMobileReferencesOpen = false;
	}

	function selectConfigureProvider(provider: ByokProvider) {
		configureProvider = provider;
		configureApiKey = '';
		configureError = '';
	}

	async function saveConfigureKey() {
		const apiKey = configureApiKey.trim();
		if (!apiKey || isSavingKey) return;

		isSavingKey = true;
		configureError = '';
		try {
			const result = await upsertKey(configureProvider, apiKey);
			if (!result.ok) {
				configureError = result.error.message;
				return;
			}

			await loadLlmOptions();
			configureApiKey = '';
			isConfigureDialogOpen = false;
			toast.success(`${BYOK_PROVIDER_OPTIONS.find((item) => item.id === configureProvider)?.label} key saved`);
		} catch (err) {
			console.error('[Chat Detail] Failed to save BYOK key:', err);
			configureError = 'Failed to save API key.';
		} finally {
			isSavingKey = false;
		}
	}

	async function resetConfigureKey() {
		if (isResettingKey) return;

		isResettingKey = true;
		configureError = '';
		try {
			const result = await deleteKey(configureProvider);
			if (!result.ok) {
				configureError = result.error.message;
				return;
			}

			await loadLlmOptions();
			toast.success(`${BYOK_PROVIDER_OPTIONS.find((item) => item.id === configureProvider)?.label} key reset`);
		} catch (err) {
			console.error('[Chat Detail] Failed to reset BYOK key:', err);
			configureError = 'Failed to reset API key.';
		} finally {
			isResettingKey = false;
		}
	}

	onMount(async () => {
		console.log(`[Chat Detail] Mounted view for chat ID: ${chatId}`);
		setTimeout(() => {
			isMounted = true;
		}, 50);

		if (textInput) textInput.focus();

		try {
			const res = await getMeUsage();
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

	$effect(() => {
		if (messages.length) {
			tick().then(() => {
				scrollToBottom();
				updateActiveCheckpoint();
			});
		}
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

	function triggerFileInput() {
		if (fileInput) fileInput.click();
	}

	function showError(msg: string) {
		if (window.matchMedia('(max-width: 767px)').matches) {
			mobileHeaderState.showError(msg);
		} else {
			toast.error('Error', { description: msg });
		}
	}

	function handleFileChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			const validFiles: File[] = [];

			for (let i = 0; i < target.files.length; i++) {
				const file = target.files[i];

				const allowedExtensions = ['.pdf', '.docx', '.txt'];
				const lowerName = file.name.toLowerCase();
				if (!allowedExtensions.some((ext) => lowerName.endsWith(ext))) {
					showError(
						`File "${file.name}" has an invalid extension. Only PDF, DOCX, and TXT are allowed.`
					);
					continue;
				}

				if (file.size > maxFileSizeBytes) {
					showError(
						`File "${file.name}" exceeds the ${maxFileSizeMB}MB limit for your plan and was rejected.`
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

	async function streamChatTurn(questionText: string, modelChoice: LlmOption) {
		if (!questionText || isGenerating) return;

		const useByok = modelChoice.provider !== 'auto';
		const bodyPayload: Record<string, any> = {
			question: questionText,
			conversation_id: chatId,
			useByok
		};

		if (useByok) {
			bodyPayload.provider = modelChoice.provider;
			bodyPayload.model = modelChoice.model;
		}

		console.log('[Chat Detail] Form Submitted (Outbound Payload):', bodyPayload);

		const userMsg: ChatMessage = {
			id: `user-${Date.now()}`,
			role: 'user',
			content: questionText,
			timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
			attachments: attachedFiles.map((f) => ({ name: f.name, size: f.size }))
		};

		messages = [...messages, userMsg];
		inputValue = '';
		attachedFiles = [];
		isGenerating = true;
		startThinkingTimer();

		// Instantly move active conversation item to top of sidebar
		conversationsStore.addOrUpdate(chatId, conversationTitle);

		const assistantMsgId = `asst-${Date.now()}`;
		const assistantMsg: ChatMessage = {
			id: assistantMsgId,
			role: 'assistant',
			modelName: modelChoice.name,
			timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
			content: '',
			isStreaming: true,
			isCancelled: false,
			references: []
		};

		messages = [...messages, assistantMsg];
		const asstIndex = messages.length - 1;

		let streamBuffer = '';
		let isStreamDone = false;
		let streamHadError = false;
		let typewriterTimer: ReturnType<typeof setInterval> | null = null;
		let wasCancelled = false;

		const startTypewriter = () => {
			if (typewriterTimer) clearInterval(typewriterTimer);
			typewriterTimer = setInterval(() => {
				if (messages[asstIndex].content.length < streamBuffer.length) {
					const delta = Math.min(3, streamBuffer.length - messages[asstIndex].content.length);
					messages[asstIndex].content += streamBuffer.substring(
						messages[asstIndex].content.length,
						messages[asstIndex].content.length + delta
					);
					if (chatContainer) {
						chatContainer.scrollTop = chatContainer.scrollHeight;
					}
				} else if (isStreamDone) {
					clearInterval(typewriterTimer!);
					typewriterTimer = null;

					messages[asstIndex].isStreaming = false;
					isGenerating = false;
					if (activeAbortController === abortController) {
						activeAbortController = null;
						cancelActiveStream = null;
						activeStreamReader = null;
					}
					isTitleLoading = false;
					stopThinkingTimer();

					if (streamHadError) {
						messages[asstIndex].references = [];
						return;
					}

					const textContent = messages[asstIndex].content;
					const currentRefs = messages[asstIndex].references;

					if (currentRefs && currentRefs.length > 0) {
						const isNegativeAnswer =
							/(Mohon maaf|tidak mengandung informasi|tidak ditemukan|tidak ada informasi|does not contain|cannot answer|no information available)/i.test(
								textContent
							);
						const citationMatches = [
							...textContent.matchAll(/\[Doc (\d+)(?::\s*(?:Hlm\.|Pages?|Page)?\s*([^\]]+))?\]/gi)
						];

						if (isNegativeAnswer || citationMatches.length === 0) {
							messages[asstIndex].references = [];
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
							messages[asstIndex].references = filteredRefs;
						}
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
			messages[asstIndex].isStreaming = false;
			messages[asstIndex].isCancelled = true;
			isGenerating = false;
			isTitleLoading = false;
			stopThinkingTimer();
			if (activeAbortController === abortController) {
				activeAbortController = null;
				cancelActiveStream = null;
			}
		};

		try {
			const token = sessionStore.getAccessToken();
			const headers: Record<string, string> = {
				'Content-Type': 'application/json'
			};
			if (token) {
				headers['Authorization'] = `Bearer ${token}`;
			}

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
				messages[asstIndex].isStreaming = false;
				isGenerating = false;
				isTitleLoading = false;
				stopThinkingTimer();
				if (typewriterTimer) clearInterval(typewriterTimer);
				return;
			}

			if (!res.body) {
				showError('No response body returned from server');
				messages[asstIndex].isStreaming = false;
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
						reject(new DOMException("Aborted", "AbortError"));
					} else {
						onAbort = () => reject(new DOMException("Aborted", "AbortError"));
						abortController.signal.addEventListener("abort", onAbort, { once: true });
					}
				});
				let value: Uint8Array | undefined;
				let done = false;
				try {
					const result = await Promise.race([readPromise, abortPromise]);
					if (onAbort) abortController.signal.removeEventListener("abort", onAbort);
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

					if (eventName === 'references' && dataStr) {
						try {
							const parsed = JSON.parse(dataStr);
							if (parsed.references) {
								// Assign references immediately so inline citations render file names
								// while the answer is still typing. The Source References block below
								// the message is only shown once the stream is fully done.
								messages[asstIndex].references = parsed.references.map((r: any, idx: number) => ({
									id: r.documentId,
									index: r.index || idx + 1,
									name: r.title || r.documentId,
									pages: r.pages
								}));
							}
						} catch (e) {
							console.error('[Chat Detail] Failed to parse references event:', e);
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
								// Inject funny message into typewriter buffer — not saved to DB
								streamBuffer = 'Nice try, Diddy.';
								messages[asstIndex].isRejection = true;
								console.log('[Chat Detail] Prompt injection detected via SSE warning event.');
							}
						} catch (e) {
							console.error('[Chat Detail] Failed to parse warning event:', e);
						}
					} else if (eventName === 'done') {
						isStreamDone = true;
					} else if (eventName === 'error' && dataStr) {
						try {
							const parsed = JSON.parse(dataStr);
							showError(parsed.message || 'Stream error');
							console.error('[Chat Detail] Backend Response Stream Error:', parsed);
						} catch (e) {
							showError('Stream error');
						}
						streamHadError = true;
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
				messages[asstIndex].isStreaming = false;
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
				messages[asstIndex].isStreaming = false;
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
		if (!inputValue.trim() || isGenerating) return;
		streamChatTurn(inputValue.trim(), selectedModel);
	}

	function stopCurrentStream() {
		cancelActiveStream?.();
	}

	function retryMessage(userPrompt: string) {
		if (isGenerating || !userPrompt.trim()) return;
		streamChatTurn(userPrompt, selectedModel);
	}

	function resizeEditingTextInput() {
		if (!editingTextInput) return;
		editingTextInput.style.height = 'auto';
		editingTextInput.style.height = `${Math.max(editingTextInput.scrollHeight, 80)}px`;
	}

	async function beginEditMessage(msg: ChatMessage) {
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
		if (!editedPrompt || isGenerating) return;
		msg.content = editedPrompt;
		cancelEditMessage();
		streamChatTurn(editedPrompt, selectedModel);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	}

	function copyToClipboard(text: string, msgId: string) {
		const cleanText = text.replace(/\s*\[Doc [^\]]+\]/gi, '').trim();
		navigator.clipboard.writeText(cleanText);
		copiedMessageId = msgId;
		toast.success('Copied to clipboard');
		setTimeout(() => {
			if (copiedMessageId === msgId) copiedMessageId = null;
		}, 2000);
	}

	function deleteResponse(messageIndex: number) {
		const message = messages[messageIndex];
		if (!message || message.role !== 'assistant' || message.isStreaming) return;

		messages = messages.filter(
			(_item, index) =>
				index !== messageIndex &&
				!(index === messageIndex - 1 && messages[index].role === 'user')
		);
		toast.success('Response deleted');
	}
</script>

<div
	class="relative flex h-full w-full overflow-hidden bg-[#1F1E1D] font-sans text-white transition-opacity duration-500 ease-in-out {isMounted
		? 'opacity-100'
		: 'opacity-0'}"
>
	{#if citationPreview}
		<!-- Mobile: full-screen preview -->
		<div class="h-full w-full md:hidden">
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
	<div class="relative flex h-full w-full flex-col overflow-hidden">
		<!-- Ambient Background Glow Circle (Matching App Shell Layout) -->
		<div
			class="pointer-events-none absolute -top-[318px] -left-[295px] z-0 h-[1190px] w-[1190px] rounded-full opacity-[0.07]"
			style="background: linear-gradient(180deg, #ffffff 0%, #4b3117 100%); filter: blur(99px);"
		></div>

		<!-- Mobile Floating Conversation Capsule -->
		<div
			class="pointer-events-auto absolute top-3 right-3 left-3 z-30 overflow-hidden rounded-[24px] border border-white/15 bg-[#232323]/90 shadow-2xl backdrop-blur-[42px] md:hidden"
		>
			<div class="flex h-14 items-center justify-between px-3">
				<div class="flex items-center gap-1">
					<button
						type="button"
						class="flex size-9 cursor-pointer items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
						onclick={() => sidebar.toggle()}
						aria-label="Open navigation"
					>
						<Menu class="size-5" />
					</button>
					<button
						type="button"
						class="flex size-9 cursor-pointer items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
						onclick={() => goto('/app/chat')}
						aria-label="New chat"
					>
						<Plus class="size-4" />
					</button>
				</div>

				<button
					type="button"
					class="min-w-0 max-w-[45%] cursor-pointer truncate px-2 text-xs font-medium text-white/75 transition-colors hover:text-white"
					onclick={toggleMobileTitleActions}
					aria-label="Conversation actions"
				>
					{isTitleLoading ? 'Generating title...' : conversationTitle || 'New Conversation'}
				</button>

				<div class="flex items-center gap-1">
					<button
						type="button"
						class="flex size-9 cursor-pointer items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
						onclick={shareConversation}
						aria-label="Share conversation"
					>
						<Share2 class="size-4" />
					</button>
					<button
						type="button"
						class="relative flex size-9 cursor-pointer items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
						onclick={toggleMobileReferences}
						aria-label="Conversation references"
					>
						<FileText class="size-4" />
						{#if conversationReferences.length > 0}
							<span class="absolute top-0 right-0 flex size-3.5 items-center justify-center rounded-full bg-[#DB8F5E] text-[9px] font-semibold text-black">
								{conversationReferences.length}
							</span>
						{/if}
					</button>
				</div>
			</div>

			{#if isMobileTitleActionsOpen}
				<div
					transition:slide={{ duration: 420, easing: backOut }}
					class="flex items-center justify-center gap-3 border-t border-white/10 px-3 py-3"
				>
					<button
						type="button"
						class="flex size-10 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/65 transition-colors hover:bg-white/10 hover:text-white"
						onclick={openTitleEditDialog}
						aria-label="Edit conversation title"
					>
						<Pencil class="size-4" />
					</button>
					<button
						type="button"
						class="flex size-10 cursor-pointer items-center justify-center rounded-full border border-red-400/20 bg-red-400/10 text-red-300 transition-colors hover:bg-red-400/20 hover:text-red-200"
						onclick={() => (isDeleteConversationDialogOpen = true)}
						aria-label="Delete conversation"
					>
						<Trash2 class="size-4" />
					</button>
				</div>
			{/if}

			{#if isMobileReferencesOpen}
				<div
					transition:slide={{ duration: 420, easing: backOut }}
					class="max-h-56 overflow-y-auto border-t border-white/10 px-2 py-2"
				>
					{#if conversationReferences.length === 0}
						<div class="px-2 py-2 text-xs text-white/35">No references in this conversation.</div>
					{:else}
						{#each conversationReferences as reference (reference.id)}
							<button
								type="button"
								class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
								onclick={() => openCitationPreview(reference.id, reference.name, reference.pages ?? [])}
							>
								<FileText class="size-3.5 shrink-0 text-white/50" />
								<span class="min-w-0 truncate">{reference.name}</span>
							</button>
						{/each}
					{/if}
				</div>
			{/if}
		</div>

		<!-- Desktop Conversation Header -->
		<div
			class="pointer-events-none absolute top-0 right-0 left-0 z-20 hidden h-28 bg-gradient-to-b from-[#1F1E1D] via-[#1F1E1D]/95 via-65% to-transparent md:block"
		>
			<div class="pointer-events-auto grid h-16 w-full grid-cols-3 items-center px-4 md:px-8">
				<div class="flex justify-start">
					<button
						type="button"
						class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white/55 transition-colors hover:bg-white/10 hover:text-white"
						onclick={() => goto('/app/chat')}
					>
						<Plus class="size-4" />
						<span>New chat</span>
					</button>
				</div>

				<div class="flex min-w-0 justify-center">
					<DropdownMenu.Root>
						<DropdownMenu.Trigger
							class="flex max-w-full cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white focus:outline-none"
						>
							<span class="max-w-56 truncate">
								{isTitleLoading ? 'New Conversation' : conversationTitle || 'New Conversation'}
							</span>
							<ChevronDown class="size-3.5 shrink-0 text-white/45" />
						</DropdownMenu.Trigger>
						<DropdownMenu.Content class="w-48 border-white/10 bg-[#232323] text-white">
							<DropdownMenu.Item
								class="flex cursor-pointer items-center gap-2 text-xs text-white/75 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white"
								onclick={openTitleEditDialog}
							>
								<Pencil class="size-3.5 text-white/60" />
								<span>Edit title</span>
							</DropdownMenu.Item>
							<DropdownMenu.Separator class="bg-white/10" />
							<DropdownMenu.Item
								class="flex cursor-pointer items-center gap-2 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 focus:bg-red-500/10 focus:text-red-300"
								onclick={() => (isDeleteConversationDialogOpen = true)}
							>
								<Trash2 class="size-3.5" />
								<span>Delete conversation</span>
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</div>

				<div class="flex justify-end gap-1">
					<button
						type="button"
						class="flex size-8 cursor-pointer items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/10 hover:text-white"
						onclick={shareConversation}
						aria-label="Share conversation"
					>
						<Share2 class="size-4" />
					</button>
					<DropdownMenu.Root>
						<DropdownMenu.Trigger
							class="relative flex size-8 cursor-pointer items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/10 hover:text-white focus:outline-none"
							aria-label="Conversation references"
						>
							<FileText class="size-4" />
							{#if conversationReferences.length > 0}
								<span class="absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-[#DB8F5E] text-[9px] font-semibold text-black">
									{conversationReferences.length}
								</span>
							{/if}
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="end" class="w-72 border-white/10 bg-[#232323] p-1 text-white">
							<div class="px-2.5 py-2 text-xs font-medium text-white/45">Conversation references</div>
							{#if conversationReferences.length === 0}
								<div class="px-2.5 py-3 text-xs text-white/35">No references in this conversation.</div>
							{:else}
								{#each conversationReferences as reference (reference.id)}
									<DropdownMenu.Item
										class="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-xs text-white/75 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white"
										onclick={() => openCitationPreview(reference.id, reference.name, reference.pages ?? [])}
									>
																		<FileText class="size-3.5 shrink-0 text-white/50" />
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
					class="grid h-64 items-center py-2"
					style={`grid-template-rows: repeat(${conversationCheckpoints.length}, minmax(0, 1fr));`}
				>
					{#each conversationCheckpoints as checkpoint (checkpoint.id)}
						<button
							type="button"
							class="h-0.5 w-3 cursor-pointer rounded-full transition-all duration-300 hover:w-4 {checkpoint.id === currentCheckpointId
								? 'bg-[#DB8F5E]'
								: 'bg-white/25'}"
							onclick={() => scrollToCheckpoint(checkpoint.id)}
							aria-label={`Jump to checkpoint: ${checkpoint.content}`}
						>
						</button>
					{/each}
				</div>

				<div
					class="pointer-events-none absolute top-1/2 right-0 w-64 -translate-y-1/2 translate-x-2 rounded-2xl border border-white/10 bg-[#232323]/90 p-2 opacity-0 shadow-2xl backdrop-blur-[32px] transition-all duration-300 group-hover/checkpoints:pointer-events-auto group-hover/checkpoints:translate-x-0 group-hover/checkpoints:opacity-100"
				>
					<div class="max-h-64 overflow-y-auto">
						{#each conversationCheckpoints as checkpoint (checkpoint.id)}
							<button
								type="button"
								class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-white/10 {checkpoint.id ===
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
								class="flex max-w-[85%] flex-col items-end gap-1.5 md:max-w-[70%] {editingMessageId === msg.id
									? 'w-full'
									: ''}"
							>
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
											maxlength={690}
											rows={1}
											class="min-h-20 w-full resize-none overflow-hidden rounded-md border border-white/20 bg-black/20 p-2 text-sm text-white outline-none"
											aria-label="Edit question"
											oninput={resizeEditingTextInput}
										></textarea>
										<div class="mt-2 flex items-center justify-between gap-2">
											<div
												class="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] {editingMessageValue.length >=
													690
													? 'text-red-400'
													: 'text-white/40'}"
											>
												<Keyboard class="size-3" />
												<span>{editingMessageValue.length}/690</span>
											</div>
											<div class="flex justify-end gap-2">
												<Button variant="ghost" size="sm" onclick={cancelEditMessage}>Cancel</Button>
												<Button
													size="sm"
													disabled={!editingMessageValue.trim()}
													onclick={() => saveEditMessage(msg)}>Save &amp; resubmit</Button
												>
											</div>
										</div>
									{:else}
										{#if msg.attachments && msg.attachments.length > 0}
											<div class="mb-2 flex flex-wrap gap-1.5">
												{#each msg.attachments as att}
													<span
														class="inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/30 px-2 py-0.5 text-xs text-white/80"
													>
														<FileText class="size-3 text-white/60" />
														{att.name}
													</span>
												{/each}
											</div>
										{/if}

										<p class="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
									{/if}
								</div>

								<!-- Action Toolbar for User Question (Copy & Edit) -->
								<div class="flex items-center gap-1 pr-1 text-white/40">
									<Button
										variant="ghost"
										size="icon"
										class="h-6 w-6 cursor-pointer text-white/40 hover:bg-white/10 hover:text-white"
										onclick={() => copyToClipboard(msg.content, msg.id)}
										aria-label="Copy question"
									>
										{#if copiedMessageId === msg.id}
											<Check class="size-3 text-green-400" />
										{:else}
											<Copy class="size-3" />
										{/if}
									</Button>
									{#if msg.id === lastUserMsgId}
										<Button
											variant="ghost"
											size="icon"
											class="h-6 w-6 cursor-pointer text-white/40 hover:bg-white/10 hover:text-white"
											onclick={() => beginEditMessage(msg)}
											aria-label="Edit question"
										>
											<Pencil class="size-3" />
										</Button>
									{/if}
								</div>
							</div>
						</div>
					{:else}
						<!-- Assistant Response (Flat & Clean, No Card Bubble, No Avatar, No Timestamps) -->
						<div class="flex w-full justify-start py-2">
							<div class="flex w-full flex-col gap-3">
								<!-- Markdown Content View -->
								<div
									role="none"
									class="prose prose-sm max-w-none text-white/90 prose-invert prose-headings:font-semibold prose-headings:text-white prose-p:leading-relaxed prose-a:text-white/90 prose-a:underline hover:prose-a:text-white prose-code:rounded prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-white/90 prose-code:before:content-none prose-code:after:content-none prose-pre:my-3 prose-pre:border prose-pre:border-white/10 prose-pre:bg-black/50 prose-li:my-1"
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
									{#if msg.content}
										{@html renderMarkdown(msg.content, msg.references)}
									{:else if msg.isStreaming}
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

								<!-- Document Reference Chips -->
								{#if !msg.isStreaming && !msg.isCancelled && msg.references && msg.references.length > 0}
									<div class="mt-2 border-t border-white/10 pt-3">
										<div class="mb-2 flex items-center gap-1.5 text-xs font-medium text-white/60">
											<BookOpen class="size-3.5 text-white/60" />
											<span>Source References ({msg.references.length})</span>
										</div>
										<div class="flex flex-wrap gap-2">
											{#each msg.references as ref}
												<Tooltip.Provider delayDuration={100}>
													<Tooltip.Root>
														<Tooltip.Trigger
															class="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-[#2B2A29] px-3 py-1 text-xs text-white/80 transition-colors hover:border-white/30 hover:bg-[#383736] hover:text-white"
															onclick={() => openCitationPreview(ref.id, ref.name, ref.pages ?? [])}
														>
															<FileText class="size-3 text-white/60" />
															<span class="font-medium">{ref.name}</span>
															{#if ref.pages && ref.pages.length > 0}
																<span class="text-white/40">• {ref.pages.join(', ')}</span>
															{:else if ref.page}
																<span class="text-white/40"
																	>• {formatPageNumbers(String(ref.page))}</span
																>
															{/if}
														</Tooltip.Trigger>
														<Tooltip.Content
															class="max-w-xs border border-white/15 bg-[#232323] text-xs text-white"
														>
															<p class="font-semibold text-white/90">{ref.name}</p>
															{#if ref.snippet}
																<p class="mt-1 text-white/70 italic">"{ref.snippet}"</p>
															{/if}
															<p class="mt-1 text-[10px] text-white/40">ID: {ref.id}</p>
														</Tooltip.Content>
													</Tooltip.Root>
												</Tooltip.Provider>
											{/each}
										</div>
									</div>
								{/if}

								<!-- Action Toolbar (Copy, Retry, Thumbs Up/Down, Dropdown Menu) -->
								<div class="flex items-center gap-1 pt-1 text-white/40">
									<Button
										variant="ghost"
										size="icon"
										class="h-7 w-7 cursor-pointer text-white/40 hover:bg-white/10 hover:text-white"
										onclick={() => copyToClipboard(msg.content, msg.id)}
										aria-label="Copy response"
									>
										{#if copiedMessageId === msg.id}
											<Check class="size-3.5 text-green-400" />
										{:else}
											<Copy class="size-3.5" />
										{/if}
									</Button>
									<Button
										variant="ghost"
										size="icon"
										class="h-7 w-7 cursor-pointer text-white/40 hover:bg-white/10 hover:text-white"
										aria-label="Helpful"
									>
										<ThumbsUp class="size-3.5" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										class="h-7 w-7 cursor-pointer text-white/40 hover:bg-white/10 hover:text-white"
										aria-label="Not helpful"
									>
										<ThumbsDown class="size-3.5" />
									</Button>
									{#if !msg.isRejection && messages[msgIndex - 1]?.role === 'user' && messages[msgIndex - 1]?.id === lastUserMsgId}
										<DropdownMenu.Root>
											<DropdownMenu.Trigger
												class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-white/40 hover:bg-white/10 hover:text-white"
												aria-label="Retry response"
											>
												<RotateCw class="size-3.5" />
											</DropdownMenu.Trigger>
											<DropdownMenu.Content
												align="start"
												class="w-36 border-white/15 bg-[#232323] p-1 text-white"
											>
												<DropdownMenu.Item
													class="flex cursor-pointer items-center gap-2 text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white focus:outline-none"
													onclick={() => retryMessage(messages[msgIndex - 1]?.content ?? '')}
												>
													<RotateCw class="size-3.5 text-white/70" />
													<span>Try Again</span>
												</DropdownMenu.Item>
													</DropdownMenu.Content>
										</DropdownMenu.Root>
									{/if}
									<!-- Triple Dot Dropdown Menu -->
									<DropdownMenu.Root>
										<DropdownMenu.Trigger
											class="flex size-7 cursor-pointer items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/10 hover:text-white focus:outline-none"
											aria-label="More options"
										>
											<Ellipsis class="size-3.5" />
										</DropdownMenu.Trigger>
										<DropdownMenu.Content
											align="start"
											class="w-48 border-white/15 bg-[#232323] text-white"
										>
											<DropdownMenu.Item
												class="flex cursor-pointer items-center gap-2 text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white focus:outline-none"
												onclick={() => toast.info('Branch in new chat coming soon')}
											>
												<GitBranch class="size-3.5 text-white/70" />
												<span>Branch in new chat</span>
											</DropdownMenu.Item>
													<DropdownMenu.Item
														class="flex cursor-pointer items-center gap-2 text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white focus:outline-none"
														onclick={() => toast.info('Read aloud coming soon')}
													>
														<Volume2 class="size-3.5 text-white/70" />
														<span>Read aloud</span>
													</DropdownMenu.Item>
													<DropdownMenu.Item
														class="flex cursor-pointer items-center gap-2 text-xs text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 focus:bg-red-500/10 focus:text-red-300 focus:outline-none"
														disabled={msg.isStreaming}
														onclick={() => deleteResponse(msgIndex)}
													>
														<Trash2 class="size-3.5" />
														<span>Delete response</span>
													</DropdownMenu.Item>
											</DropdownMenu.Content>
									</DropdownMenu.Root>
								</div>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		</div>

		<!-- Bottom Area: Floating Input Capsule with Gradient Mask -->
		<div
			class="pointer-events-none absolute right-0 bottom-0 left-0 z-30 flex flex-col items-center justify-end bg-gradient-to-t from-[#1F1E1D] via-[#1F1E1D]/90 to-transparent pt-6 pb-4"
			style="font-family: 'Inter', sans-serif;"
		>
			<div class="pointer-events-auto flex w-full max-w-4xl flex-col items-center gap-3 px-4">
				<!-- Main Input Capsule -->
				<div
					class="group flex w-full flex-col gap-1 rounded-[24px] border border-white/[0.16] bg-[#232323]/[0.85] px-4 py-2 shadow-2xl backdrop-blur-[42px] transition-all"
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
						<!-- Attach Button -->
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
										<p>Attach Document (PDF, TXT, DOCX)</p>
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
							id="file-upload-detail"
							accept=".pdf,.txt,.docx"
							class="hidden"
							multiple
							onchange={handleFileChange}
						/>

						<!-- Textarea -->
						<Textarea
							bind:ref={textInput}
							bind:value={inputValue}
							maxlength={690}
							rows={1}
							placeholder="Ask a follow-up question..."
							class="max-h-32 min-h-[36px] flex-1 resize-none scrollbar-thin scrollbar-thumb-white/[0.16] scrollbar-track-transparent overflow-y-auto border-0 border-transparent bg-transparent py-1.5 text-white shadow-none ring-0 transition-colors outline-none placeholder:text-white/[0.40] focus-within:text-white hover:scrollbar-thumb-white/[0.40] focus:border-0 focus:border-transparent focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
							onkeydown={(e) => {
								if (e.key === 'Enter' && !e.shiftKey) {
									e.preventDefault();
									handleSendMessage();
								}
							}}
							oninput={(e) => {
								const target = e.currentTarget as HTMLTextAreaElement;
								if (target) {
									target.style.height = 'auto';
									if (target.value) {
										target.style.height = Math.min(target.scrollHeight, 128) + 'px';
									}
								}
							}}
						/>

						<!-- Model Switcher Dropdown -->
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
									<DropdownMenu.Content
										class="w-80 border border-white/[0.16] bg-[#232323]/95 p-0 text-white backdrop-blur-[42px]"
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
														<img src={option.icon} alt={option.name} class="size-4 brightness-0 invert opacity-60" />
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
												onclick={() => openConfigureDialog()}
													>
														<Settings2 class="size-3.5" />
														<span>Configure</span>
													</DropdownMenu.Item>
										</div>
									</DropdownMenu.Content>
							</DropdownMenu.Root>
						</div>

						<!-- Send Button -->
						<button
							class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white hover:text-black disabled:opacity-40"
							disabled={!isGenerating && !inputValue.trim() && attachedFiles.length === 0}
							onclick={isGenerating ? stopCurrentStream : handleSendMessage}
							aria-label={isGenerating ? 'Stop generating' : 'Send Message'}
						>
							{#if isGenerating}
								<Square class="size-4" />
							{:else}
								<SendHorizontal class="size-5 -rotate-90" />
							{/if}
						</button>
					</div>
				</div>

				<!-- Lower Row: Disclaimer & Counter -->
				<div class="flex w-full items-center justify-between px-2 text-xs text-white/40">
					<p class="text-[11px] text-white/40 select-none">
						Dokyudo can make mistakes. Check important info.
					</p>

					<!-- Keyboard length counter -->
					<div
						class="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] {inputValue.length >=
						690
							? 'text-red-400'
							: 'text-white/40'}"
					>
						<Keyboard class="size-3" />
						<span>{inputValue.length}/690</span>
					</div>
				</div>
			</div>
		</div>
	</div>
{/snippet}

<Dialog.Root bind:open={isConfigureDialogOpen}>
	<Dialog.Content
		showCloseButton={false}
		class="w-full max-w-lg border border-white/10 bg-[#232323] p-0 text-white shadow-2xl"
	>
		<button
			type="button"
			onclick={() => (isConfigureDialogOpen = false)}
			class="absolute top-4 right-4 z-10 flex size-8 cursor-pointer items-center justify-center rounded-md text-white/45 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
			aria-label="Close configure dialog"
		>
			<X class="size-4" />
		</button>
		<Dialog.Header class="border-b border-white/10 px-6 py-5">
			<Dialog.Title class="text-lg font-semibold text-white">Configure BYOK</Dialog.Title>
			<Dialog.Description class="text-sm text-white/45">
				Connect your own API key to access provider models directly.
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex gap-2 border-b border-white/10 px-6 py-3">
			{#each BYOK_PROVIDER_OPTIONS as provider (provider.id)}
				<button
					type="button"
					class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors {configureProvider ===
						provider.id
						? 'border-[#DB8F5E]/60 bg-[#DB8F5E]/10 text-white'
						: 'border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.08] hover:text-white/80'}"
					onclick={() => selectConfigureProvider(provider.id)}
				>
					<img src={provider.icon} alt={provider.label} class="size-4 shrink-0 brightness-0 invert opacity-70" />
					<span class="min-w-0 truncate text-xs font-medium">{provider.label}</span>
				</button>
			{/each}
		</div>

		<div class="flex flex-col gap-3 px-6 py-5">
			<div class="flex items-center justify-between gap-3">
				<div>
					<p class="text-sm font-medium text-white/85">
						{BYOK_PROVIDER_OPTIONS.find((item) => item.id === configureProvider)?.label} API key
					</p>
					<p class="mt-1 text-xs text-white/40">
						{BYOK_PROVIDER_OPTIONS.find((item) => item.id === configureProvider)?.description}
					</p>
				</div>
				<KeyRound class="size-4 text-white/35" />
			</div>

			{#if configuredKeyMasks[configureProvider]}
				<div class="flex h-10 items-center justify-between rounded-lg border border-white/15 bg-black/20 px-3">
					<div class="flex items-center gap-2 text-sm text-white/75">
						<Check class="size-4 text-white/60" />
						<span>API Key Configured</span>
					</div>
					<button
						type="button"
						class="flex cursor-pointer items-center gap-1 text-xs text-white/50 transition-colors hover:text-white/85 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={isResettingKey}
						onclick={resetConfigureKey}
					>
						<RotateCw class="size-3.5" />
						<span>{isResettingKey ? 'Resetting...' : 'Reset Key'}</span>
					</button>
				</div>
			{:else}
				<Input
					type="password"
					bind:value={configureApiKey}
					placeholder={BYOK_PROVIDER_OPTIONS.find((item) => item.id === configureProvider)?.placeholder}
					class="h-10 border-white/15 bg-black/20 text-sm text-white placeholder:text-white/25 focus-visible:border-[#DB8F5E]/60 focus-visible:ring-[#DB8F5E]/20"
					autocomplete="new-password"
				/>
			{/if}

			{#if configureError}
				<p class="text-xs text-red-400">{configureError}</p>
			{/if}
		</div>

		<Dialog.Footer class="border-t border-white/10 px-6 py-4">
			<Button
				variant="ghost"
				class="cursor-pointer text-white/60 hover:bg-white/10 hover:text-white"
				disabled={isSavingKey}
				onclick={() => (isConfigureDialogOpen = false)}
			>
				Cancel
			</Button>
			<Button
				class="cursor-pointer bg-[#DB8F5E] text-black hover:bg-[#E59C6D] disabled:opacity-50"
				disabled={!configureApiKey.trim() || isSavingKey || isResettingKey}
				onclick={saveConfigureKey}
			>
				{#if isSavingKey}
					<Spinner class="mr-2" />
					Saving...
				{:else}
					Save key
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

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
</style>

<Dialog.Root bind:open={isTitleEditDialogOpen}>
	<Dialog.Content class="border-white/10 bg-[#232323] text-white sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title class="text-lg font-semibold text-white">Edit conversation title</Dialog.Title>
			<Dialog.Description class="text-sm text-white/45">
				Choose a title that makes this conversation easy to find later.
			</Dialog.Description>
		</Dialog.Header>
		<Input
			type="text"
			bind:value={titleDraft}
			placeholder="Conversation title"
			maxlength={100}
			disabled={isTitleSaving}
			class="border-white/15 bg-black/20 text-white placeholder:text-white/25 focus-visible:border-[#DB8F5E]/60 focus-visible:ring-[#DB8F5E]/20"
		/>
		<Dialog.Footer class="mt-1 flex gap-2 sm:justify-end">
			<Button
				variant="ghost"
				class="cursor-pointer text-white/60 hover:bg-white/10 hover:text-white"
				disabled={isTitleSaving}
				onclick={() => (isTitleEditDialogOpen = false)}
			>
				Cancel
			</Button>
			<Button
				class="cursor-pointer bg-[#DB8F5E] text-black hover:bg-[#E59C6D] disabled:opacity-50"
				disabled={!titleDraft.trim() || isTitleSaving}
				onclick={saveConversationTitle}
			>
				{#if isTitleSaving}
					<Spinner class="mr-2" />
					Saving...
				{:else}
					Save title
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={isDeleteConversationDialogOpen}>
	<Dialog.Content class="border-white/10 bg-[#232323] text-white sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title class="text-lg font-semibold text-white">Delete conversation?</Dialog.Title>
			<Dialog.Description class="text-sm text-white/45">
				This will permanently delete this conversation and its history.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="mt-1 flex gap-2 sm:justify-end">
			<Button
				variant="ghost"
				class="cursor-pointer text-white/60 hover:bg-white/10 hover:text-white"
				disabled={isConversationDeleting}
				onclick={() => (isDeleteConversationDialogOpen = false)}
			>
				Cancel
			</Button>
			<Button
				class="cursor-pointer bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
				disabled={isConversationDeleting}
				onclick={deleteCurrentConversation}
			>
				{#if isConversationDeleting}
					<Spinner class="mr-2" />
					Deleting...
				{:else}
					Delete conversation
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
