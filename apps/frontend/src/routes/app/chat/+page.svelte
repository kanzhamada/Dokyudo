<script lang="ts">
	import MxIcon from '$lib/components/icons/MxIcon.svelte';
	import type { MxIconName } from '$lib/components/icons/mx-icons-data';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import * as Tabs from '$lib/components/ui/tabs';
	import ChatInput from '$lib/components/chat/ChatInput.svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { getMeUsageCached } from '$lib/state/me-cache.store.svelte';
	import { seo } from '$lib/seo';
	import { getKeys } from '$lib/api/keys';
	import { uploadFilesAsDocuments, type ChatAttachment } from '$lib/api/documents';
	import { documentsStore } from '$lib/state/documents.store.svelte';
	import { accountPanel, openAccountPanel } from '$lib/state/account-panel.store.svelte';
	import { mentionStrippedLength } from '$lib/utils/doc-mentions';
	import { TIER_LIMITS, type TierType } from '$lib/constants/tiers.constant';

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

	let llmOptions: LlmOption[] = $state(INITIAL_LLM_OPTIONS);

	let activeMode = $state('chat');
	let inputValue = $state('');
	let selectedModel: LlmOption = $state(llmOptions[0]);
	let attachedFiles: File[] = $state([]);
	let isUploading = $state(false);
	/** Sparkles toggle state (menggantikan tombol attach di input landing) —
	 * search bar ini akan terhubung dengan search bar Documents nanti. */
	let aiSearchEnabled = $state(false);

	// Global Usage Constraints (Dynamic based on Tenant Tier)
	let baseUploads = $state(0);
	let maxUploads = $state(10);
	let baseStorage = $state(0);
	let maxStorage = $state(100 * 1024 * 1024); // 100MB default

	let maxFileSizeBytes = $state(10 * 1024 * 1024); // 10MB default

	let searchesCount = $state(0);
	let maxSearches = $state(100);

	let qaCount = $state(0);
	let maxQa = $state(50);

	// Derived UI states
	let currentUploadCount = $derived(baseUploads + attachedFiles.length);
	let currentStorageBytes = $derived(
		baseStorage + attachedFiles.reduce((acc, file) => acc + file.size, 0)
	);

	let storageDisplay = $derived.by(() => {
		if (maxStorage >= 1024 * 1024 * 1024) {
			const usedGB = (currentStorageBytes / (1024 * 1024 * 1024)).toFixed(1);
			const maxGB = (maxStorage / (1024 * 1024 * 1024)).toFixed(1);
			return `${usedGB}/${maxGB}GB`;
		}
		const usedMB = (currentStorageBytes / (1024 * 1024)).toFixed(1);
		const maxMB = (maxStorage / (1024 * 1024)).toFixed(0);
		return `${usedMB}/${maxMB}MB`;
	});

	onMount(async () => {
		// Warm the document mention cache — idempotent, and the `@` popover also
		// ensures it lazily, so this only makes the first mention instant.
		documentsStore.ensureLoaded();

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
			console.error('[Chat Page] Failed to fetch usage:', err);
		}

		await loadLlmOptions();
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
			console.error('[Chat Page] Failed to fetch BYOK keys:', err);
		}
	}

	function triggerHaptic(duration = 20) {
		if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
			try {
				navigator.vibrate(duration);
			} catch {
				// Unsupported
			}
		}
	}

	function openConfigureDialog() {
		openAccountPanel('byok');
	}

	$effect(() => {
		if (accountPanel.byokSavedAt > 0) void loadLlmOptions();
	});

	async function handleSubmit() {
		if (mentionStrippedLength(inputValue.trim()) === 0 || isUploading) return;

		if (activeMode === 'chat') {
			// Upload attached files BEFORE navigating — the conversation does not
			// exist yet, so the detail page receives their document ids through
			// navigation state and sends the turn with them. The server then
			// waits for ingestion before answering.
			let attachmentDocuments: ChatAttachment[] | undefined;
			if (attachedFiles.length > 0) {
				isUploading = true;
				const uploadRes = await uploadFilesAsDocuments(attachedFiles);
				isUploading = false;
				if (!uploadRes.ok) {
					toast.error('Upload failed', { description: uploadRes.error });
					return;
				}
				attachmentDocuments = uploadRes.attachments;
				// Newly uploaded documents are now referenceable via `@` — drop
				// the mention cache so the next popover shows them.
				documentsStore.invalidate();
			}

			const newId = crypto.randomUUID();
			// NOTE: the initial question is deliberately NOT logged (privacy).
			goto(`/app/chat/${newId}`, {
				state: {
					initialQuestion: inputValue.trim(),
					selectedModel: $state.snapshot(selectedModel),
					attachmentDocuments
				}
			});
		} else if (activeMode === 'search') {
			// Connect to the Documents page search: navigate with the query and
			// the search mode (Sparkles toggle ON = semantic, OFF = keyword) as
			// URL params. This navigation is animated by the view transition in
			// app/+layout.svelte (scoped to submit navigations from /app/chat).
			const query = inputValue.trim();
			if (!query) return;
			const mode = aiSearchEnabled ? 'semantic' : 'keyword';
			goto(`/app/documents?q=${encodeURIComponent(query)}&mode=${mode}`);
		}
	}
</script>

<svelte:head>
	{@html seo({ title: 'Chat | Dokyudo', description: 'Ask questions and get answers powered by your documents.', noindex: true })}
</svelte:head>

<div class="relative flex h-full w-full items-center justify-center overflow-hidden p-4">
	<!-- Reusable Svelte 5 Snippets for Usage Metrics -->
	{#snippet desktopUsageMetric(
		icon: MxIconName,
		valueText: string,
		tooltipText: string,
		basePercent: number,
		totalPercent: number
	)}
		<Tooltip.Provider delayDuration={100}>
			<Tooltip.Root>
				<Tooltip.Trigger
					class="flex cursor-pointer items-center gap-1.5 transition-colors hover:text-white/[0.80]"
				>
					<div class="relative flex size-3.5 items-center justify-center">
						<svg class="size-full -rotate-90 text-white/[0.16]" viewBox="0 0 100 100">
							<circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="16" />
							{#if totalPercent > basePercent}
								<circle
									cx="50"
									cy="50"
									r="40"
									fill="none"
									stroke="#f59e0b"
									stroke-width="16"
									stroke-dasharray="251.2"
									stroke-dashoffset={251.2 * (1 - totalPercent)}
									class="transition-all"
								/>
							{/if}
							<circle
								cx="50"
								cy="50"
								r="40"
								fill="none"
								stroke="white"
								stroke-width="16"
								stroke-dasharray="251.2"
								stroke-dashoffset={251.2 * (1 - basePercent)}
								class="transition-all"
							/>
						</svg>
					</div>
					<span>{valueText}</span>
					{#if typeof icon === 'string'}
						<MxIcon name={icon} class="size-3.5" />
					{:else}
						<MxIcon name="database-outline" class="size-3.5" />
					{/if}
				</Tooltip.Trigger>
				<Tooltip.Content
					class="border-white/[0.16] bg-[#232323] text-white"
					arrowClasses="bg-[#232323] border-white/[0.16] border-b border-r"
				>
					<p>{tooltipText}</p>
				</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
	{/snippet}

	{#snippet mobileUsageMetric(
		icon: MxIconName,
		label: string,
		valueText: string,
		basePercent: number,
		totalPercent: number
	)}
		<div class="flex flex-col gap-1.5">
			<div class="flex justify-between text-xs text-white/[0.69]">
				<div class="flex items-center gap-1.5">
					{#if typeof icon === 'string'}
						<MxIcon name={icon} class="size-3.5" />
					{:else}
						<MxIcon name="database-outline" class="size-3.5" />
					{/if}
					<span>{label}</span>
				</div>
				<span>{valueText}</span>
			</div>
			<div class="relative h-1.5 w-full overflow-hidden rounded-full bg-white/[0.16]">
				{#if totalPercent > basePercent}
					<div
						class="absolute top-0 left-0 h-full bg-amber-500 transition-all"
						style="width: {totalPercent * 100}%;"
					></div>
				{/if}
				<div
					class="absolute top-0 left-0 z-10 h-full bg-white transition-all"
					style="width: {basePercent * 100}%;"
				></div>
			</div>
		</div>
	{/snippet}

	<!-- Background Video (Local static video, full-screen cover including behind sidebar) -->
	<div class="pointer-events-none fixed inset-0 z-0 h-screen w-screen overflow-hidden" aria-hidden="true">
		<video
			class="h-full w-full object-cover object-center"
			autoplay
			loop
			muted
			playsinline
			preload="auto"
		>
			<source src="/videos/_%20_project_metadata_.mp4" type="video/mp4" />
			<source src="/videos/_ _project_metadata_.mp4" type="video/mp4" />
		</video>
		<!-- Dark overlay for readability: solid black at 69% opacity -->
		<div class="absolute inset-0 bg-black/42"></div>
	</div>

	<!-- Chat Interface Container -->
	<div
		class="absolute bottom-4 left-1/2 flex w-full max-w-4xl -translate-x-1/2 flex-col items-center gap-3 px-4"
		style="font-family: 'Inter', sans-serif;"
	>
		<!-- Main Input Capsule (reusable ChatInput) -->
		<ChatInput
			bind:value={inputValue}
			bind:attachedFiles
			bind:selectedModel
			{llmOptions}
			placeholder={activeMode === 'search'
				? 'Search documents using semantic search...'
				: 'Ask a question about your documents...'}
			showModelSelector={activeMode === 'chat'}
			refocusKey={activeMode}
			transparent
			showSparkleToggle={activeMode === 'search'}
			bind:sparkleActive={aiSearchEnabled}
			{isUploading}
			{baseUploads}
			{maxUploads}
			{baseStorage}
			{maxStorage}
			{maxFileSizeBytes}
			onsend={handleSubmit}
			onconfigure={openConfigureDialog}
		/>

		<!-- 2. Lower Row: Mode Toggles & Usage Info
		     Fixed h-8: keeps this row's height identical to the disclaimer row
		     on /app/chat/[id], so the ChatInput capsule sits at the exact same
		     bottom offset on both pages (no visual jump on page transition). -->
		<div class="@container flex h-8 w-full flex-row items-center justify-between px-2">
			<!-- Mode Toggle Tabs -->
			<div class="flex shrink-0 flex-row items-center gap-3">
				<Tabs.Root bind:value={activeMode}>
					<Tabs.List class="flex items-center gap-3 bg-transparent p-0">
						<Tooltip.Provider delayDuration={100}>
							<Tooltip.Root>
								<Tooltip.Trigger>
									{#snippet child({ props })}
										<Tabs.Trigger
											{...props}
											value="chat"
											onclick={() => triggerHaptic(20)}
											class="flex cursor-pointer select-none items-center gap-2 rounded-full px-4 py-1.5 transition-all duration-150 active:scale-[0.96]
												data-[state=active]:border-[0.74px] data-[state=active]:border-white/[0.80] data-[state=active]:bg-[#B8B5B5]/[0.40] data-[state=active]:text-white/[0.80] data-[state=active]:shadow-none data-[state=active]:backdrop-blur-[31.16px]
												data-[state=inactive]:border data-[state=inactive]:border-white/[0.16] data-[state=inactive]:bg-[#232323]/[0.40] data-[state=inactive]:text-white/[0.40] data-[state=inactive]:backdrop-blur-[42px] hover:data-[state=inactive]:border-[0.74px] hover:data-[state=inactive]:border-white/[0.80] hover:data-[state=inactive]:bg-[#B8B5B5]/[0.40] hover:data-[state=inactive]:text-white/[0.80] hover:data-[state=inactive]:backdrop-blur-[31.16px]"
										>
											{#if activeMode === 'chat'}
												<MxIcon name="chat-round-line-bold" class="size-4" />
											{:else}
												<MxIcon name="chat-round-line-linear" class="size-4" />
											{/if}
											<span class="text-sm">Chat</span>
										</Tabs.Trigger>
									{/snippet}
								</Tooltip.Trigger>
								<Tooltip.Content
									class="border-white/[0.16] bg-[#232323] text-white"
									arrowClasses="bg-[#232323] border-white/[0.16] border-b border-r"
								>
									<p>Chat with your documents</p>
								</Tooltip.Content>
							</Tooltip.Root>
						</Tooltip.Provider>

						<Tooltip.Provider delayDuration={100}>
							<Tooltip.Root>
								<Tooltip.Trigger>
									{#snippet child({ props })}
										<Tabs.Trigger
											{...props}
											value="search"
											onclick={() => triggerHaptic(20)}
											class="flex cursor-pointer select-none items-center gap-2 rounded-full px-4 py-1.5 transition-all duration-150 active:scale-[0.96]
												data-[state=active]:border-[0.74px] data-[state=active]:border-white/[0.80] data-[state=active]:bg-[#B8B5B5]/[0.40] data-[state=active]:text-white/[0.80] data-[state=active]:shadow-none data-[state=active]:backdrop-blur-[31.16px]
												data-[state=inactive]:border data-[state=inactive]:border-white/[0.16] data-[state=inactive]:bg-[#232323]/[0.40] data-[state=inactive]:text-white/[0.40] data-[state=inactive]:backdrop-blur-[42px] hover:data-[state=inactive]:border-[0.74px] hover:data-[state=inactive]:border-white/[0.80] hover:data-[state=inactive]:bg-[#B8B5B5]/[0.40] hover:data-[state=inactive]:text-white/[0.80] hover:data-[state=inactive]:backdrop-blur-[31.16px]"
										>
											{#if activeMode === 'search'}
												<MxIcon name="receipt-search-bold" class="size-4" />
											{:else}
												<MxIcon name="receipt-search-outline" class="size-4" />
											{/if}
											<span class="text-sm">Search</span>
										</Tabs.Trigger>
									{/snippet}
								</Tooltip.Trigger>
								<Tooltip.Content
									class="border-white/[0.16] bg-[#232323] text-white"
									arrowClasses="bg-[#232323] border-white/[0.16] border-b border-r"
								>
									<p>Search across your documents</p>
								</Tooltip.Content>
							</Tooltip.Root>
						</Tooltip.Provider>
					</Tabs.List>
				</Tabs.Root>
			</div>

			<!-- Right Side (Char Count & Usage Info) -->
			<div class="flex items-center gap-2 @3xl:gap-3">
				<!-- Character Count Indicator Capsule -->
				<div
					class="flex shrink-0 select-none items-center gap-1.5 rounded-full border border-white/[0.16] bg-[#232323]/[0.40] px-3 py-1.5 text-xs backdrop-blur-[42px] transition-colors {mentionStrippedLength(
						inputValue
					) >= 690
						? 'text-red-400'
						: 'text-white/[0.40]'}"
				>
					<MxIcon
						name={inputValue.length >= 690 ? 'devices-keyboard-bold' : 'devices-keyboard-outline'}
						class="size-3.5"
					/>
					<span class="font-medium">{mentionStrippedLength(inputValue)}/690</span>
				</div>

				<!-- Usage Info Capsule (Desktop) -->
				<div
					class="hidden shrink-0 select-none items-center gap-4 rounded-full border border-white/[0.16] bg-[#232323]/[0.40] px-4 py-1.5 text-xs text-white/[0.40] backdrop-blur-[42px] transition-colors @3xl:flex"
				>
					{@render desktopUsageMetric(
						'document-upload-outline',
						`${currentUploadCount}/${maxUploads}`,
						`Document Uploads (${currentUploadCount} of ${maxUploads} used)`,
						baseUploads / maxUploads,
						currentUploadCount / maxUploads
					)}
					{@render desktopUsageMetric(
						'database-outline',
						storageDisplay,
						`Document Storage (${storageDisplay} used)`,
						baseStorage / maxStorage,
						currentStorageBytes / maxStorage
					)}
					{@render desktopUsageMetric(
						'receipt-search-outline',
						`${searchesCount}/${maxSearches}`,
						`Semantic Searches (${searchesCount} of ${maxSearches} used)`,
						searchesCount / maxSearches,
						searchesCount / maxSearches
					)}
					{@render desktopUsageMetric(
						'chat-round-line-linear',
						`${qaCount}/${maxQa}`,
						`Chat Messages (${qaCount} of ${maxQa} used)`,
						qaCount / maxQa,
						qaCount / maxQa
					)}
				</div>

				<!-- Usage Info Capsule (Mobile Dropdown) -->
				<div class="flex shrink-0 items-center @3xl:hidden">
					<DropdownMenu.Root>
						<DropdownMenu.Trigger
							onclick={() => triggerHaptic(15)}
							class="flex size-8 cursor-pointer select-none items-center justify-center rounded-full border border-white/[0.16] bg-[#232323]/[0.40] text-white/[0.40] backdrop-blur-[42px] transition-all duration-150 hover:border-[0.74px] hover:border-white/[0.80] hover:bg-[#B8B5B5]/[0.40] hover:text-white/[0.80] hover:backdrop-blur-[31.16px] active:scale-[0.90] focus:outline-none"
						>
							<MxIcon name="diagram-up-bold" class="size-4" />
						</DropdownMenu.Trigger>
						<DropdownMenu.Content
							class="w-56 border border-white/[0.16] bg-[#232323]/40 p-3 text-white backdrop-blur-[42px]"
							align="end"
						>
							<div class="mb-3 text-xs font-medium text-white/[0.69]">Usage Information</div>
							<div class="flex flex-col gap-3">
								{@render mobileUsageMetric(
									'document-upload-outline',
									'Document Uploads',
									`${currentUploadCount}/${maxUploads}`,
									baseUploads / maxUploads,
									currentUploadCount / maxUploads
								)}
								{@render mobileUsageMetric(
									'database-outline',
									'Document Storage',
									storageDisplay,
									baseStorage / maxStorage,
									currentStorageBytes / maxStorage
								)}
								{@render mobileUsageMetric(
									'receipt-search-outline',
									'Semantic Searches',
									`${searchesCount}/${maxSearches}`,
									searchesCount / maxSearches,
									searchesCount / maxSearches
								)}
								{@render mobileUsageMetric(
									'chat-round-line-linear',
									'Chat Messages',
									`${qaCount}/${maxQa}`,
									qaCount / maxQa,
									qaCount / maxQa
								)}
							</div>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	:global(button),
	:global(a) {
		-webkit-tap-highlight-color: rgba(255, 255, 255, 0.08);
		-webkit-touch-callout: none;
		touch-action: manipulation;
	}
</style>
