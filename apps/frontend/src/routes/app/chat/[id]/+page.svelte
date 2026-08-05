<script lang="ts">
	import { onMount, tick } from 'svelte';
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
		RotateCw
	} from 'lucide-svelte';

	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import * as Tabs from '$lib/components/ui/tabs';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { toast } from 'svelte-sonner';
	import { mobileHeaderState } from '$lib/state/mobile-header.svelte.js';
	import { getMeUsage } from '$lib/api/me';
	import { getKeys } from '$lib/api/keys';
	import { getConversation } from '$lib/api/rag';
	import { TIER_LIMITS, type TierType } from '$lib/constants/tiers.constant';
	import { PUBLIC_API_URL } from '$env/static/public';
	import { dokyudoFetch } from '$lib/apiClient';
	import { sessionStore } from '$lib/state/session.store.svelte';
	import { conversationsStore } from '$lib/state/conversations.store.svelte';
	import { marked } from 'marked';

	marked.setOptions({
		gfm: true,
		breaks: true
	});

	function transformCitationTags(html: string, references?: DocReference[]): string {
		if (!html) return '';
		return html.replace(/\[Doc (\d+)(?:: (?:Hlm\.|Pages?|Page) ([^\]]+))?\]/g, (_match, docIdxStr, pageInfo) => {
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
					docDisplayName = cleanName.length > 5 ? cleanName.slice(0, 5) + '...' : cleanName;
				}
			}

			const label = pageInfo ? `${docDisplayName} • Hlm. ${pageInfo}` : docDisplayName;
			return `<span data-doc-id="${docId}" data-doc-title="${docFullName}" data-pages="${pageInfo || ''}" class="inline-flex items-center gap-1 rounded border border-amber-400/30 bg-amber-400/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-300 transition-colors hover:bg-amber-400/25 cursor-pointer" title="${tooltipTitle}">${label}</span>`;
		});
	}

	function wrapWordsInHtml(html: string): string {
		if (!html) return '';
		const parts = html.split(/(<[^>]+>)/g);
		let inCode = false;

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			if (!part) continue;

			if (part.startsWith('<')) {
				const lower = part.toLowerCase();
				if (lower.startsWith('<code') || lower.startsWith('<pre')) {
					inCode = true;
				} else if (lower.startsWith('</code') || lower.startsWith('</pre')) {
					inCode = false;
				}
			} else if (!inCode) {
				parts[i] = part.replace(/(\S+)/g, '<span class="animate-word-fade-in">$1</span>');
			}
		}

		return parts.join('');
	}

	function renderMarkdown(text: string, references?: DocReference[]): string {
		if (!text) return '';
		try {
			const rawHtml = marked.parse(text) as string;
			const citedHtml = transformCitationTags(rawHtml, references);
			return wrapWordsInHtml(citedHtml);
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

	interface DocReference {
		id: string;
		index?: number;
		name: string;
		page?: number;
		pages?: number[];
		snippet?: string;
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

	// Conversation metadata
	let chatId = $derived(page.params.id || 'chat-default');
	let conversationTitle = $state('New Conversation');
	let isTitleLoading = $state(false);

	// Conversation Messages
	let messages: ChatMessage[] = $state([]);

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

		try {
			const keysRes = await getKeys();
			if (keysRes.ok && keysRes.data?.data && keysRes.data.data.length > 0) {
				const dynamicOptions: LlmOption[] = [
					{ name: 'Free Auto', provider: 'auto', model: 'auto', icon: geminiIcon }
				];

				for (const item of keysRes.data.data) {
					const icon = PROVIDER_ICONS[item.provider.toLowerCase()] || geminiIcon;
					if (Array.isArray(item.models)) {
						for (const model of item.models) {
							dynamicOptions.push({
								name: model,
								provider: item.provider,
								model: model,
								icon
							});
						}
					}
				}

				llmOptions = dynamicOptions;
				selectedModel = llmOptions[0];
			}
		} catch (err) {
			console.error('[Chat Detail] Failed to fetch BYOK keys:', err);
		}

		// Fetch existing conversation turns
		try {
			console.log(`[Chat Detail] Fetching conversation history for ID: ${chatId}`);
			const convRes = await getConversation(chatId);
			if (convRes.ok) {
				console.log(`[Chat Detail] Backend Response getConversation:`, convRes);
				if (convRes.data.title) conversationTitle = convRes.data.title;
				if (convRes.data.turns && convRes.data.turns.length > 0) {
					const historyMsgs: ChatMessage[] = [];
					for (const turn of convRes.data.turns) {
						historyMsgs.push({
							id: `${turn.id}-user`,
							role: 'user',
							content: turn.question,
							timestamp: new Date(turn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
						});
						historyMsgs.push({
							id: `${turn.id}-asst`,
							role: 'assistant',
							modelName: turn.modelUsed || undefined,
							content: turn.answer,
							timestamp: new Date(turn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
							references: turn.contextReferences?.map((r: any) => ({
								id: r.documentId,
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
			console.error('[Chat Detail] Failed to load conversation:', err);
		}

		// Check for initial chat question passed via history.state or page.state from /app/chat
		const stateObj = ((page as any)?.state as any) || (history.state as any)?.usr || (history.state as any);
		console.log('[Chat Detail] Navigated State Object:', stateObj);

		if (stateObj && stateObj.initialQuestion) {
			isTitleLoading = true;
			const initialQ = stateObj.initialQuestion as string;
			const initialModel = (stateObj.selectedModel as LlmOption) || selectedModel;
			if (stateObj.selectedModel) {
				selectedModel = stateObj.selectedModel as LlmOption;
			}
			console.log('[Chat Detail] Auto-starting initial chat stream for question:', initialQ);
			streamChatTurn(initialQ, initialModel);
		}

		scrollToBottom();
	});

	$effect(() => {
		if (messages.length) {
			tick().then(scrollToBottom);
		}
	});

	function scrollToBottom() {
		if (chatContainer) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}
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

		const assistantMsgId = `asst-${Date.now()}`;
		const assistantMsg: ChatMessage = {
			id: assistantMsgId,
			role: 'assistant',
			modelName: modelChoice.name,
			timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
			content: '',
			isStreaming: true,
			references: []
		};

		messages = [...messages, assistantMsg];
		const asstIndex = messages.length - 1;

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
				body: JSON.stringify(bodyPayload)
			});

			if (!res.ok) {
				const errorData = await res.json().catch(() => ({ message: 'Failed to start chat stream' }));
				console.error('[Chat Detail] Backend Response Error:', errorData);
				showError(errorData.message || 'Error executing chat request');
				messages[asstIndex].isStreaming = false;
				isGenerating = false;
				isTitleLoading = false;
				return;
			}

			if (!res.body) {
				showError('No response body returned from server');
				messages[asstIndex].isStreaming = false;
				isGenerating = false;
				isTitleLoading = false;
				return;
			}

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { value, done } = await reader.read();
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
								messages[asstIndex].references = parsed.references.map((r: any, idx: number) => ({
									id: r.documentId,
									index: r.index || (idx + 1),
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
								messages[asstIndex].content += parsed.token;
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
					} else if (eventName === 'done') {
						messages[asstIndex].isStreaming = false;
						isGenerating = false;
						isTitleLoading = false;

						const textContent = messages[asstIndex].content;
						const currentRefs = messages[asstIndex].references;

						if (currentRefs && currentRefs.length > 0) {
							// Parse all inline citation tags: [Doc N: Hlm. X, Y]
							const citationMatches = [...textContent.matchAll(/\[Doc (\d+)(?:: (?:Hlm\.|Pages?|Page) ([^\]]+))?\]/gi)];
							
							if (citationMatches.length === 0) {
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

								// Filter references: only keep documents that were cited, and set pages to cited pages
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

						console.log('[Chat Detail] Backend Response (Stream Complete):', {
							id: assistantMsgId,
							answerLength: messages[asstIndex].content.length
						});
					} else if (eventName === 'error' && dataStr) {
						try {
							const parsed = JSON.parse(dataStr);
							showError(parsed.message || 'Stream error');
							console.error('[Chat Detail] Backend Response Stream Error:', parsed);
						} catch (e) {
							showError('Stream error');
						}
						messages[asstIndex].isStreaming = false;
						isGenerating = false;
						isTitleLoading = false;
					}
				}
			}
		} catch (err: any) {
			console.error('[Chat Detail] Stream Catch Error:', err);
			showError(err.message || 'Network error streaming chat');
		} finally {
			messages[asstIndex].isStreaming = false;
			isGenerating = false;
			isTitleLoading = false;
		}
	}

	function handleSendMessage() {
		if (!inputValue.trim() || isGenerating) return;
		streamChatTurn(inputValue.trim(), selectedModel);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	}

	function copyToClipboard(text: string, msgId: string) {
		const cleanText = text.replace(/\s*\[Doc \d+(?:: (?:Hlm\.|Pages?|Page) [^\]]+)?\]/g, '').trim();
		navigator.clipboard.writeText(cleanText);
		copiedMessageId = msgId;
		toast.success('Copied to clipboard');
		setTimeout(() => {
			if (copiedMessageId === msgId) copiedMessageId = null;
		}, 2000);
	}
</script>

<div
	class="relative flex h-full w-full flex-col overflow-hidden bg-[#1F1E1D] font-sans text-white transition-opacity duration-500 ease-in-out {isMounted
		? 'opacity-100'
		: 'opacity-0'}"
>
	<!-- Ambient Background Glow Circle (Matching App Shell Layout) -->
	<div
		class="pointer-events-none absolute -top-[318px] -left-[295px] z-0 h-[1190px] w-[1190px] rounded-full opacity-[0.07]"
		style="background: linear-gradient(180deg, #ffffff 0%, #4b3117 100%); filter: blur(99px);"
	></div>

	<!-- Center Scrollable Chat Area -->
	<div
		bind:this={chatContainer}
		class="relative z-10 flex flex-1 min-h-0 flex-col overflow-y-auto px-4 pt-16 md:pt-8 md:px-8 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
	>
		<div class="mx-auto flex w-full max-w-4xl flex-col space-y-6 pb-48">
			{#each messages as msg (msg.id)}
				{#if msg.role === 'user'}
					<!-- User Message (Clean Pill) -->
					<div class="flex w-full justify-end">
						<div class="flex max-w-[85%] flex-col items-end gap-1.5 md:max-w-[70%]">
							<div
								class="rounded-2xl border border-white/15 bg-[#2B2A29] px-4 py-3 text-sm text-white/90 shadow-md backdrop-blur-md"
							>
								{#if msg.attachments && msg.attachments.length > 0}
									<div class="mb-2 flex flex-wrap gap-1.5">
										{#each msg.attachments as att}
											<span
												class="inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/30 px-2 py-0.5 text-xs text-amber-300/90"
											>
												<FileText class="size-3" />
												{att.name}
											</span>
										{/each}
									</div>
								{/if}

								<p class="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
							</div>

							<!-- Action Toolbar for User Question (Copy & Edit) -->
							<div class="flex items-center gap-1 pr-1 text-white/40">
								<Button
									variant="ghost"
									size="icon"
									class="h-6 w-6 text-white/40 hover:bg-white/10 hover:text-white"
									onclick={() => copyToClipboard(msg.content, msg.id)}
									aria-label="Copy question"
								>
									{#if copiedMessageId === msg.id}
										<Check class="size-3 text-green-400" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</Button>
								<Button
									variant="ghost"
									size="icon"
									class="h-6 w-6 text-white/40 hover:bg-white/10 hover:text-white"
									onclick={() => toast.info('Edit question feature coming soon')}
									aria-label="Edit question"
								>
									<Pencil class="size-3" />
								</Button>
							</div>
						</div>
					</div>
				{:else}
					<!-- Assistant Response (Flat & Clean, No Card Bubble, No Avatar, No Timestamps) -->
					<div class="flex w-full justify-start py-2">
						<div class="flex w-full flex-col gap-3">
							<!-- Markdown Content View -->
							<div
								class="prose prose-invert prose-sm max-w-none text-white/90 prose-headings:font-semibold prose-headings:text-white prose-p:leading-relaxed prose-pre:my-3 prose-pre:border prose-pre:border-white/10 prose-pre:bg-black/50 prose-code:rounded prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-amber-300 prose-code:before:content-none prose-code:after:content-none prose-a:text-amber-400 prose-li:my-1"
							>
								{@html renderMarkdown(msg.content, msg.references)}

								{#if msg.isStreaming}
									<span
										class="inline-block h-4 w-1.5 animate-pulse bg-amber-400 align-middle ml-1"
									></span>
								{/if}
							</div>

							<!-- Document Reference Chips -->
							{#if msg.references && msg.references.length > 0}
								<div class="mt-2 border-t border-white/10 pt-3">
									<div class="mb-2 flex items-center gap-1.5 text-xs font-medium text-white/60">
										<BookOpen class="size-3.5 text-amber-400" />
										<span>Source References ({msg.references.length})</span>
									</div>
									<div class="flex flex-wrap gap-2">
										{#each msg.references as ref}
											<Tooltip.Provider delayDuration={100}>
												<Tooltip.Root>
													<Tooltip.Trigger
														class="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-[#1A1918] px-3 py-1 text-xs text-amber-300/90 transition-colors hover:border-amber-400/50 hover:bg-[#2B2A29]"
													>
														<FileText class="size-3 text-amber-400" />
														<span class="font-medium">{ref.name}</span>
														{#if ref.pages && ref.pages.length > 0}
															<span class="text-white/40">• Hlm. {ref.pages.join(', ')}</span>
														{:else if ref.page}
															<span class="text-white/40">• Hlm. {ref.page}</span>
														{/if}
													</Tooltip.Trigger>
													<Tooltip.Content
														class="border border-white/15 bg-[#232323] text-white text-xs max-w-xs"
													>
														<p class="font-semibold text-amber-400">{ref.name}</p>
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
									class="h-7 w-7 text-white/40 hover:bg-white/10 hover:text-white"
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
									class="h-7 w-7 text-white/40 hover:bg-white/10 hover:text-white"
									onclick={() => toast.info('Regenerate response coming soon')}
									aria-label="Retry response"
								>
									<RotateCw class="size-3.5" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									class="h-7 w-7 text-white/40 hover:bg-white/10 hover:text-white"
									aria-label="Helpful"
								>
									<ThumbsUp class="size-3.5" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									class="h-7 w-7 text-white/40 hover:bg-white/10 hover:text-white"
									aria-label="Not helpful"
								>
									<ThumbsDown class="size-3.5" />
								</Button>

								<!-- Triple Dot Dropdown Menu -->
								<DropdownMenu.Root>
									<DropdownMenu.Trigger
										class="flex size-7 cursor-pointer items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/10 hover:text-white focus:outline-none"
										aria-label="More options"
									>
										<Ellipsis class="size-3.5" />
									</DropdownMenu.Trigger>
									<DropdownMenu.Content align="start" class="w-48 border-white/15 bg-[#232323] text-white">
										<DropdownMenu.Item
											class="flex cursor-pointer items-center gap-2 text-xs text-white/80 hover:bg-white/10 hover:text-white"
											onclick={() => toast.info('Branch in new chat coming soon')}
										>
											<GitBranch class="size-3.5 text-amber-400" />
											<span>Branch in new chat</span>
										</DropdownMenu.Item>
										<DropdownMenu.Item
											class="flex cursor-pointer items-center gap-2 text-xs text-white/80 hover:bg-white/10 hover:text-white"
											onclick={() => toast.info('Read aloud coming soon')}
										>
											<Volume2 class="size-3.5 text-amber-400" />
											<span>Read aloud</span>
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
		class="pointer-events-none absolute bottom-0 left-0 right-0 z-30 flex flex-col items-center justify-end pb-4 pt-20 bg-gradient-to-t from-[#1F1E1D] via-[#1F1E1D]/90 to-transparent"
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
					placeholder={activeMode === 'search'
						? 'Search documents in this conversation...'
						: 'Ask a follow-up question...'}
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
							target.style.height = Math.min(target.scrollHeight, 128) + 'px';
						}
					}}
				/>

				<!-- Model Switcher Dropdown -->
				{#if activeMode === 'chat'}
					<div class="relative flex h-9 items-center">
						<DropdownMenu.Root>
							<DropdownMenu.Trigger
								class="flex cursor-pointer items-center gap-1 px-2 py-1 text-white/[0.40] transition-colors focus-within:text-white/[0.69] hover:text-white/[0.69] focus:outline-none"
							>
								<img
									src={selectedModel.icon}
									alt={selectedModel.name}
									class="size-5 opacity-40 brightness-0 invert transition-opacity focus-within:opacity-[0.69] hover:opacity-[0.69]"
								/>
								<span class="hidden text-sm sm:inline">{selectedModel.name}</span>
								<ChevronDown class="size-4" />
							</DropdownMenu.Trigger>
							<DropdownMenu.Content
								class="max-h-60 w-64 overflow-y-auto border border-white/[0.16] bg-[#232323]/90 text-white backdrop-blur-[42px]"
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
						</DropdownMenu.Root>
					</div>
				{/if}

				<!-- Send Button -->
				<button
					class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-amber-500 hover:text-black disabled:opacity-40"
					disabled={!inputValue.trim() && attachedFiles.length === 0}
					onclick={handleSendMessage}
					aria-label="Send Message"
				>
					<SendHorizontal class="size-5 -rotate-90" />
				</button>
			</div>
		</div>

		<!-- Lower Row: Mode Toggles & Counter -->
		<div class="flex w-full items-center justify-between px-2 text-xs text-white/40">
			<div class="flex items-center gap-2">
				<Tabs.Root bind:value={activeMode}>
					<Tabs.List class="flex items-center gap-2 bg-transparent p-0">
						<Tabs.Trigger
							value="chat"
							class="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all data-[state=active]:border border-white/20 data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50"
						>
							<MessageSquare class="size-3.5" />
							<span>Chat</span>
						</Tabs.Trigger>
						<Tabs.Trigger
							value="search"
							class="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs transition-all data-[state=active]:border border-white/20 data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/50"
						>
							<Search class="size-3.5" />
							<span>Search</span>
						</Tabs.Trigger>
					</Tabs.List>
				</Tabs.Root>
			</div>

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

<style>
	@keyframes wordFadeIn {
		0% {
			opacity: 0;
			filter: blur(4px);
			transform: translateY(2px);
		}
		100% {
			opacity: 1;
			filter: blur(0);
			transform: translateY(0);
		}
	}
	:global(.animate-word-fade-in) {
		display: inline-block;
		animation: wordFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}
</style>
