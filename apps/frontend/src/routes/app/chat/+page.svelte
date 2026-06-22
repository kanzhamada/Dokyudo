<script lang="ts">
	import {
		Paperclip,
		Bot,
		SendHorizontal,
		MessageSquare,
		Search,
		ChevronDown,
		Activity,
		Keyboard,
		FileUp,
		Database,
		X
	} from 'lucide-svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import * as Tabs from '$lib/components/ui/tabs';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';
	import { mobileHeaderState } from '$lib/state/mobile-header.svelte.js';

	import claudeIcon from '$lib/assets/llm/claude.svg';
	import cohereIcon from '$lib/assets/llm/cohere.svg';
	import geminiIcon from '$lib/assets/llm/gemini.svg';
	import groqIcon from '$lib/assets/llm/groq.svg';
	import metaIcon from '$lib/assets/llm/meta.svg';
	import mistralIcon from '$lib/assets/llm/mistral.svg';
	import openaiIcon from '$lib/assets/llm/openai.svg';
	import openrouterIcon from '$lib/assets/llm/openrouter.svg';

	const llmOptions = [
		{ name: 'Gemini 3.1 Pro', icon: geminiIcon },
		{ name: 'GPT-4o', icon: openaiIcon },
		{ name: 'Claude 3.5 Sonnet', icon: claudeIcon },
		{ name: 'Meta Llama 3', icon: metaIcon },
		{ name: 'Mistral Large', icon: mistralIcon },
		{ name: 'Cohere Command R', icon: cohereIcon },
		{ name: 'Groq', icon: groqIcon },
		{ name: 'OpenRouter', icon: openrouterIcon }
	];

	let activeMode = $state('chat');
	let fileInput: HTMLInputElement | null = $state(null);
	let textInput: HTMLTextAreaElement | null = $state(null);
	let inputValue = $state('');
	let selectedModel = $state(llmOptions[0]);
	let attachedFiles: File[] = $state([]);

	// Global Usage Constraints
	let baseUploads = 0; // Mock base count from server
	let maxUploads = 5;

	let baseStorage = 0.3 * 1024 * 1024 * 1024; // 0.3GB mock base from server
	let maxStorage = 5 * 1024 * 1024 * 1024; // 5GB limit

	// Derived UI states
	let currentUploadCount = $derived(baseUploads + attachedFiles.length);
	let currentStorageBytes = $derived(
		baseStorage + attachedFiles.reduce((acc, file) => acc + file.size, 0)
	);
	let currentStorageGB = $derived((currentStorageBytes / (1024 * 1024 * 1024)).toFixed(1));

	onMount(() => {
		if (textInput) textInput.focus();
	});

	$effect(() => {
		let currentMode = activeMode;
		if (textInput) {
			setTimeout(() => textInput?.focus(), 0);
		}
	});

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
			const maxFileSize = 25 * 1024 * 1024; // 25MB
			const validFiles: File[] = [];

			for (let i = 0; i < target.files.length; i++) {
				const file = target.files[i];

				// 0. Extension validation
				const allowedExtensions = ['.pdf', '.docx', '.txt'];
				const lowerName = file.name.toLowerCase();
				if (!allowedExtensions.some(ext => lowerName.endsWith(ext))) {
					showError(`File "${file.name}" has an invalid extension. Only PDF, DOCX, and TXT are allowed.`);
					continue;
				}

				// 1. Individual 25MB check
				if (file.size > maxFileSize) {
					showError(`File "${file.name}" exceeds the 25MB limit and was rejected.`);
					continue;
				}

				// 2. Global count check
				if (attachedFiles.length + validFiles.length + 1 > maxUploads - baseUploads) {
					showError(
						`Cannot attach "${file.name}": Exceeds maximum upload limit of ${maxUploads}.`
					);
					continue;
				}

				// 3. Global size check
				const upcomingSize = currentStorageBytes + validFiles.reduce((acc, f) => acc + f.size, 0) + file.size;
				if (upcomingSize > maxStorage) {
					showError(`Cannot attach "${file.name}": Exceeds 5GB storage limit.`);
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
</script>

<div class="relative flex h-full w-full items-center justify-center overflow-hidden p-4">
	<!-- Reusable Svelte 5 Snippets for Usage Metrics -->
	{#snippet desktopUsageMetric(
		icon: any,
		valueText: string,
		tooltipText: string,
		basePercent: number,
		totalPercent: number
	)}
		{@const Icon = icon}
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
					<Icon class="size-3.5" />
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
		icon: any,
		label: string,
		valueText: string,
		basePercent: number,
		totalPercent: number
	)}
		{@const Icon = icon}
		<div class="flex flex-col gap-1.5">
			<div class="flex justify-between text-xs text-white/[0.69]">
				<div class="flex items-center gap-1.5">
					<Icon class="size-3.5" />
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

	<!-- Background Video -->
	<video
		src="/videos/infiniteloop_bg_pingpong.mp4"
		class="absolute inset-0 -z-10 h-full w-full object-cover"
		autoplay
		muted
		loop
		playsinline
	></video>

	<!-- Chat Interface Container -->
	<div
		class="absolute bottom-12 left-1/2 flex w-full max-w-6xl -translate-x-1/2 flex-col items-center gap-4 px-4"
		style="font-family: 'Inter', sans-serif;"
	>
		<!-- Main Input Capsule -->
		<div
			class="group flex w-full flex-col gap-1 rounded-[24px] border border-white/[0.16] bg-[#232323]/[0.40] px-4 py-2 backdrop-blur-[42px] transition-all"
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
				<!-- Element 1.1: Attach Document -->
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
									{maxUploads - currentUploadCount} uploads remaining • Max 25MB/file
								</p>
							</Tooltip.Content>
						</Tooltip.Root>
					</Tooltip.Provider>
				</div>
				<Input
					type="file"
					bind:ref={fileInput}
					id="file-upload"
					accept=".pdf,.txt,.docx"
					class="hidden"
					multiple
					onchange={handleFileChange}
				/>

				<!-- Element 1.2: Input Text Field -->
				<Textarea
					bind:ref={textInput}
					bind:value={inputValue}
					maxlength={690}
					rows={1}
					placeholder={activeMode === 'search'
						? 'Search documents using semantic search...'
						: 'Ask a question about your documents...'}
					class="max-h-32 min-h-[36px] flex-1 resize-none scrollbar-thin scrollbar-thumb-white/[0.16] scrollbar-track-transparent overflow-y-auto border-0 border-transparent bg-transparent py-1.5 text-white/[0.40] shadow-none ring-0 transition-colors outline-none placeholder:text-white/[0.40] focus-within:text-white/[0.69] focus-within:placeholder-white/[0.69] hover:scrollbar-thumb-white/[0.40] focus:border-0 focus:border-transparent focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
					oninput={(e) => {
						const target = e.currentTarget as HTMLTextAreaElement;
						if (target) {
							target.style.height = 'auto';
							target.style.height = Math.min(target.scrollHeight, 128) + 'px';
						}
					}}
				/>

				<!-- Element 1.3: Model Dropdown Switch -->
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
								class="w-52 border border-white/[0.16] bg-[#232323]/40 text-white backdrop-blur-[42px]"
							>
								{#each llmOptions as option}
									<DropdownMenu.Item
										class="flex cursor-pointer items-center gap-2 focus:bg-white/[0.16] focus:text-white"
										onclick={() => (selectedModel = option)}
									>
										<img src={option.icon} alt={option.name} class="size-4 brightness-0 invert" />
										<span>{option.name}</span>
									</DropdownMenu.Item>
								{/each}
							</DropdownMenu.Content>
						</DropdownMenu.Root>
					</div>
				{/if}

				<!-- Element 1.4: Send Button -->
				<button
					class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#B8B5B5]/[0] text-white/[0.80] backdrop-blur-[31.16px]"
				>
					<SendHorizontal class="size-5 -rotate-90" />
				</button>
			</div>
		</div>

		<!-- 2. Lower Row: Mode Toggles & Usage Info -->
		<div class="@container flex w-full flex-row items-center justify-between px-2">
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
											class="flex cursor-pointer items-center gap-2 rounded-full px-4 py-1.5 transition-all
												data-[state=active]:border-[0.74px] data-[state=active]:border-white/[0.80] data-[state=active]:bg-[#B8B5B5]/[0.40] data-[state=active]:text-white/[0.80] data-[state=active]:shadow-none data-[state=active]:backdrop-blur-[31.16px]
												data-[state=inactive]:border data-[state=inactive]:border-white/[0.16] data-[state=inactive]:bg-[#232323]/[0.40] data-[state=inactive]:text-white/[0.40] data-[state=inactive]:backdrop-blur-[42px] hover:data-[state=inactive]:border-[0.74px] hover:data-[state=inactive]:border-white/[0.80] hover:data-[state=inactive]:bg-[#B8B5B5]/[0.40] hover:data-[state=inactive]:text-white/[0.80] hover:data-[state=inactive]:backdrop-blur-[31.16px]"
										>
											<MessageSquare class="size-4" />
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
											class="flex cursor-pointer items-center gap-2 rounded-full px-4 py-1.5 transition-all
												data-[state=active]:border-[0.74px] data-[state=active]:border-white/[0.80] data-[state=active]:bg-[#B8B5B5]/[0.40] data-[state=active]:text-white/[0.80] data-[state=active]:shadow-none data-[state=active]:backdrop-blur-[31.16px]
												data-[state=inactive]:border data-[state=inactive]:border-white/[0.16] data-[state=inactive]:bg-[#232323]/[0.40] data-[state=inactive]:text-white/[0.40] data-[state=inactive]:backdrop-blur-[42px] hover:data-[state=inactive]:border-[0.74px] hover:data-[state=inactive]:border-white/[0.80] hover:data-[state=inactive]:bg-[#B8B5B5]/[0.40] hover:data-[state=inactive]:text-white/[0.80] hover:data-[state=inactive]:backdrop-blur-[31.16px]"
										>
											<Search class="size-4" />
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
					class="flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.16] bg-[#232323]/[0.40] px-3 py-1.5 text-xs backdrop-blur-[42px] transition-colors {inputValue.length >=
					690
						? 'text-red-400'
						: 'text-white/[0.40]'}"
				>
					<Keyboard class="size-3.5" />
					<span class="font-medium">{inputValue.length}/690</span>
				</div>

				<!-- Usage Info Capsule (Desktop) -->
				<div
					class="hidden shrink-0 items-center gap-4 rounded-full border border-white/[0.16] bg-[#232323]/[0.40] px-4 py-1.5 text-xs text-white/[0.40] backdrop-blur-[42px] transition-colors @3xl:flex"
				>
					{@render desktopUsageMetric(
						FileUp,
						`${currentUploadCount}/${maxUploads}`,
						`Document Uploads (${currentUploadCount} of ${maxUploads} used)`,
						baseUploads / maxUploads,
						currentUploadCount / maxUploads
					)}
					{@render desktopUsageMetric(
						Database,
						`${currentStorageGB}/5GB`,
						`Document Storage (${currentStorageGB} of 5 GB used)`,
						baseStorage / maxStorage,
						currentStorageBytes / maxStorage
					)}
					{@render desktopUsageMetric(
						Search,
						'4/50',
						'Semantic Searches (4 of 50 used)',
						4 / 50,
						4 / 50
					)}
					{@render desktopUsageMetric(
						MessageSquare,
						'9/10',
						'Chat Messages (9 of 10 used)',
						9 / 10,
						9 / 10
					)}
				</div>

				<!-- Usage Info Capsule (Mobile Dropdown) -->
				<div class="flex shrink-0 items-center @3xl:hidden">
					<DropdownMenu.Root>
						<DropdownMenu.Trigger
							class="flex size-8 cursor-pointer items-center justify-center rounded-full border border-white/[0.16] bg-[#232323]/[0.40] text-white/[0.40] backdrop-blur-[42px] transition-colors hover:border-[0.74px] hover:border-white/[0.80] hover:bg-[#B8B5B5]/[0.40] hover:text-white/[0.80] hover:backdrop-blur-[31.16px] focus:outline-none"
						>
							<Activity class="size-4" />
						</DropdownMenu.Trigger>
						<DropdownMenu.Content
							class="w-56 border border-white/[0.16] bg-[#232323]/40 p-3 text-white backdrop-blur-[42px]"
							align="end"
						>
							<div class="mb-3 text-xs font-medium text-white/[0.69]">Usage Information</div>
							<div class="flex flex-col gap-3">
								{@render mobileUsageMetric(
									FileUp,
									'Document Uploads',
									`${currentUploadCount}/${maxUploads}`,
									baseUploads / maxUploads,
									currentUploadCount / maxUploads
								)}
								{@render mobileUsageMetric(
									Database,
									'Document Storage',
									`${currentStorageGB}/5GB`,
									baseStorage / maxStorage,
									currentStorageBytes / maxStorage
								)}
								{@render mobileUsageMetric(Search, 'Semantic Searches', '4/50', 4 / 50, 4 / 50)}
								{@render mobileUsageMetric(MessageSquare, 'Chat Messages', '9/10', 9 / 10, 9 / 10)}
							</div>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</div>
			</div>
		</div>
	</div>
</div>
