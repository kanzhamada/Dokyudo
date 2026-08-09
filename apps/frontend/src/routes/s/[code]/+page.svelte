<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		Copy,
		Check,
		FileText,
		BookOpen,
		Square,
		TriangleAlert,
		ShieldAlert,
		Lock,
		GitBranch,
		Clock,
		Share2
	} from 'lucide-svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Spinner } from '$lib/components/ui/spinner';
	import { Button } from '$lib/components/ui/button';
	import CodeBlockPreview from '$lib/components/chat/CodeBlockPreview.svelte';
	import { continueShare, getPublicShare } from '$lib/api/rag';
	import { sessionStore } from '$lib/state/session.store.svelte';
	import { marked } from 'marked';
	import { mount, unmount, untrack } from 'svelte';
	import type { PublicShare, PublicShareTurn } from '$lib/types/rag.types';
	import favicon from '$lib/assets/favicon.svg';

	const customRenderer = new marked.Renderer();
	customRenderer.code = ({ text, lang }: { text: string; lang?: string }) => {
		const cleanLang = (lang || '').trim().toLowerCase();
		const encodedCode = encodeURIComponent(text);
		return `<div class="code-block-embed my-3" data-code="${encodedCode}" data-lang="${cleanLang}"></div>`;
	};

	marked.setOptions({
		gfm: true,
		breaks: true,
		renderer: customRenderer
	});

	function formatPageNumbers(raw: string): string {
		if (!raw) return '';
		const expanded = raw.replace(/(\d+)\s*-\s*(\d+)/g, (_m, startStr, endStr) => {
			const start = Number(startStr);
			const end = Number(endStr);
			if (end > start && end - start < 30) {
				const arr: number[] = [];
				for (let i = start; i <= end; i++) arr.push(i);
				return arr.join(', ');
			}
			return `${startStr}, ${endStr}`;
		});
		const matches = expanded.match(/\d+/g);
		if (!matches || matches.length === 0) return raw.trim();
		return Array.from(new Set(matches.map(Number)))
			.sort((a, b) => a - b)
			.join(', ');
	}

	function escapeHtml(value: string): string {
		return value
			.replace(/&/g, '&amp;')
			.replace(/"/g, '&quot;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
	}

	/**
	 * Inline citation chips — identical look to the chat page, but static:
	 * no document preview (public viewers have no document access) and no
	 * tooltip interaction. Title + pages come from the share snapshot.
	 */
	function transformCitationTags(
		html: string,
		references?: PublicShareTurn['contextReferences']
	): string {
		const isNegativeAnswer =
			/(Mohon maaf|tidak mengandung informasi|tidak ditemukan|tidak ada informasi|does not contain|cannot answer|no information available)/i.test(
				html
			);
		if (isNegativeAnswer) {
			return html.replace(/\s*\[Doc [^\]]+\]/gi, '');
		}

		let cleanHtml = html.replace(/\[Doc \d+:[^\]]*;[^\]]*\]/gi, '');

		let result = cleanHtml.replace(
			/\[Doc (\d+)(?::\s*(?:Hlm\.|Pages?|Page)?\s*([^\]]+))?\]/gi,
			(_match, docIdxStr, rawPageInfo) => {
				const docIdx = Number(docIdxStr);
				let docDisplayName = `Doc ${docIdx}`;

				if (references && references.length > 0) {
					const refDoc = references.find((r) => r.index === docIdx) ?? references[docIdx - 1];
					if (refDoc && refDoc.title) {
						const cleanName = refDoc.title.replace(/\.[^/.]+$/, '');
						docDisplayName = cleanName.length > 22 ? cleanName.slice(0, 22) + '...' : cleanName;
					}
				}

				const pageFormatted = rawPageInfo ? formatPageNumbers(rawPageInfo) : '';
				const label = pageFormatted
					? `${escapeHtml(docDisplayName)} <span class="text-white/40 font-normal">• ${escapeHtml(pageFormatted)}</span>`
					: escapeHtml(docDisplayName);

				return `<span class="relative inline-flex items-center align-middle gap-1 rounded-full border border-white/15 bg-[#2B2A29] px-2.5 py-0.5 text-[11px] font-medium text-white/80 mx-0.5 my-0.5 whitespace-nowrap">${label}</span>`;
			}
		);

		return result.replace(/\s*\[Doc [^\]]+\]/gi, '');
	}

	function renderMarkdown(text: string, references?: PublicShareTurn['contextReferences']): string {
		if (!text) return '';
		try {
			const rawHtml = marked.parse(text) as string;
			return transformCitationTags(rawHtml, references);
		} catch {
			return text;
		}
	}

	// Map snapshot references to the chat page's reference shape (id/name/pages/snippet).
	function refsOf(turn: PublicShareTurn) {
		return (turn.contextReferences ?? []).map((r) => ({
			id: r.documentId,
			index: r.index ?? 1,
			name: r.title || r.documentId,
			pages: r.pages ?? [],
			snippet: (r as { snippet?: string }).snippet
		}));
	}

	const code = $derived(page.params.code ?? '');
	let share = $state<PublicShare | null>(null);
	let isLoading = $state(true);
	let notFound = $state(false);
	let isContinuing = $state(false);
	let copiedMessageId = $state<string | null>(null);
	let codeBlockInstances: { el: HTMLElement; unmount: () => void }[] = [];

	const isSignedIn = $derived(!!sessionStore.getAccessToken());
	const turnLabel = $derived(
		share ? `${share.turns.length} turn${share.turns.length === 1 ? '' : 's'}` : ''
	);
	const footerHint = $derived(
		isSignedIn
			? 'Continue in your private chat (a copy of this link).'
			: 'Sign in to continue this chat in your account.'
	);

	onMount(() => {
		loadShare();
		return () => {
			codeBlockInstances.forEach((i) => i.unmount());
			codeBlockInstances = [];
		};
	});

	async function loadShare() {
		isLoading = true;
		notFound = false;
		share = null;
		const result = await getPublicShare(code);
		if (result.ok) {
			share = result.data;
		} else {
			notFound = true;
		}
		isLoading = false;
	}

	// Mount interactive code-block previews (same mechanism as the chat page).
	$effect(() => {
		if (!share) return;
		untrack(() => {
			setTimeout(() => {
				document
					.querySelectorAll<HTMLElement>('.code-block-embed:not([data-mounted])')
					.forEach((el) => {
						const rawCode = el.getAttribute('data-code');
						const lang = el.getAttribute('data-lang') || '';
						if (rawCode) {
							el.setAttribute('data-mounted', 'true');
							const instance = mount(CodeBlockPreview, {
								target: el,
								props: { code: decodeURIComponent(rawCode), language: lang }
							});
							codeBlockInstances.push({ el, unmount: () => unmount(instance) });
						}
					});
			}, 30);
		});
	});

	async function copyToClipboard(text: string, id: string) {
		try {
			await navigator.clipboard.writeText(text);
			copiedMessageId = id;
			setTimeout(() => {
				if (copiedMessageId === id) copiedMessageId = null;
			}, 1500);
		} catch {
			// clipboard unavailable — silently ignore on public pages
		}
	}

	async function handleContinue() {
		if (isContinuing || !share) return;
		if (!sessionStore.getAccessToken()) {
			await goto(`/login?redirect=/s/${share.code}`);
			return;
		}
		isContinuing = true;
		try {
			const result = await continueShare(share.code);
			if (result.ok) {
				await goto(`/app/chat/${result.data.id}`);
			} else if (result.error.code === 'UNAUTHORIZED') {
				// Stale session — send the viewer through login again.
				await goto(`/login?redirect=/s/${share.code}`);
			} else {
				notFound = true;
			}
		} finally {
			isContinuing = false;
		}
	}

	function formatExpiry(expiresAt: string | null): string {
		if (!expiresAt) return 'No expiry';
		return `Expires ${new Date(expiresAt).toLocaleString('en-US', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		})}`;
	}

	function formatSharedDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>{share ? `${share.title} — Dokyudo` : 'Dokyudo'}</title>
</svelte:head>

<div class="relative flex h-svh w-full flex-col overflow-hidden bg-[#1F1E1D]">
	<!-- Ambient Background Glow Circle (Matching App Shell Layout) -->
	<div
		class="pointer-events-none absolute -top-[318px] -left-[295px] z-0 h-[1190px] w-[1190px] rounded-full opacity-[0.07]"
		style="background: linear-gradient(180deg, #ffffff 0%, #4b3117 100%); filter: blur(99px);"
	></div>

	<!-- ================= Mobile Header (Floating Capsule — same as chat page) ================= -->
	<div
		class="pointer-events-auto absolute top-3 right-3 left-3 z-30 overflow-hidden rounded-[24px] border border-white/15 bg-[#232323]/90 shadow-2xl backdrop-blur-[42px] md:hidden"
	>
		<div class="flex h-14 items-center justify-between px-3">
			<a href="/" class="flex shrink-0 items-center gap-1.5" aria-label="Dokyudo home">
				<img src={favicon} alt="Dokyudo" class="h-6 w-auto" />
			</a>

			<div class="flex min-w-0 flex-1 items-center justify-center px-2">
				<span class="max-w-full truncate text-xs font-medium text-white/75" title={share?.title}>
					{share?.title ?? 'Shared conversation'}
				</span>
			</div>

			<div class="flex shrink-0 items-center gap-1.5">
				<span
					class="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white/60"
					title={share ? formatExpiry(share.expiresAt) : undefined}
				>
					<Clock class="size-3 text-white/50" />
					{share?.expiresAt ? 'Expires' : 'No expiry'}
				</span>
			</div>
		</div>
	</div>

	<!-- ================= Desktop Header (Gradient Bar — same as chat page) ================= -->
	<div
		class="pointer-events-none absolute top-0 right-0 left-0 z-20 hidden h-28 bg-gradient-to-b from-[#1F1E1D] via-[#1F1E1D]/95 via-65% to-transparent md:block"
	>
		<div class="pointer-events-auto grid h-16 w-full grid-cols-3 items-center px-4 md:px-8">
			<div class="flex justify-start">
				<a
					href="/"
					class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white/55 transition-colors hover:bg-white/10 hover:text-white"
				>
					<img src={favicon} alt="Dokyudo" class="h-5 w-auto" />
					<span class="font-sans font-medium tracking-tight">Dokyudo</span>
				</a>
			</div>

			<div class="flex min-w-0 justify-center">
				{#if (share?.title ?? '').length > 25}
					<Tooltip.Provider delayDuration={100}>
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<span
										{...props}
										class="flex max-w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-white/75"
									>
										<span class="max-w-56 truncate">{share?.title ?? 'Shared conversation'}</span>
									</span>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content
								class="max-w-xs rounded-md border-0 bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
							>
								<p>{share?.title}</p>
							</Tooltip.Content>
						</Tooltip.Root>
					</Tooltip.Provider>
				{:else}
					<span
						class="flex max-w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-white/75"
					>
						<span class="max-w-56 truncate">{share?.title ?? 'Shared conversation'}</span>
					</span>
				{/if}
			</div>

			<div class="flex justify-end gap-1">
				<span
					class="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/60"
					title={share ? formatExpiry(share.expiresAt) : undefined}
				>
					<Lock class="size-3 text-white/50" />
					<span>Read-only</span>
				</span>
				<Button
					size="sm"
					class="cursor-pointer border border-white/20 bg-white/15 text-xs font-medium text-white hover:bg-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
					disabled={isContinuing || !share}
					onclick={handleContinue}
				>
					{#if isContinuing}
						<Spinner class="mr-1.5 size-3" />
						Preparing...
					{:else}
						<GitBranch class="mr-1.5 size-3.5" />
						Continue chat
					{/if}
				</Button>
			</div>
		</div>
	</div>

	<!-- ================= Main Content ================= -->
	<main
		class="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-24 md:px-8 md:pt-28"
	>
		<div class="mx-auto flex w-full max-w-4xl flex-col space-y-6 pb-32">
			{#if isLoading}
				<div class="flex flex-1 items-center justify-center py-24">
					<Spinner class="size-5 text-white/40" />
				</div>
			{:else if notFound}
				<div class="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
					<Share2 class="size-8 text-white/25" />
					<h1 class="text-lg font-semibold text-white">Link is invalid or has expired</h1>
					<p class="max-w-sm text-sm text-white/45">
						This public link has been removed by its owner, or it has expired.
					</p>
					<Button
						class="mt-2 cursor-pointer bg-amber-500 text-black hover:bg-amber-400"
						onclick={() => goto('/')}
					>
						Go to home
					</Button>
				</div>
			{:else if share}
				<!-- Read-only notice + share meta -->
				<div class="flex flex-col gap-2 pt-1">
					<div class="flex items-center gap-2">
						<span
							class="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/50"
						>
							<Lock class="size-3" />
							<span>Read-only share</span>
						</span>
						<span class="text-xs text-white/40">
							Shared {formatSharedDate(share.createdAt)} · {turnLabel}
						</span>
					</div>
				</div>

				{#each share.turns as turn, i (turn.createdAt + i)}
					<!-- User Message (Clean Pill — same as chat page) -->
					<div class="flex w-full justify-end">
						<div class="flex max-w-[85%] flex-col items-end gap-1.5 md:max-w-[70%]">
							<div
								class="w-fit rounded-2xl border border-white/15 bg-[#2B2A29] px-4 py-3 text-sm text-white/90 shadow-md backdrop-blur-md"
							>
								<p class="leading-relaxed whitespace-pre-wrap">{turn.question}</p>
							</div>

							<!-- Action Toolbar (Copy only — no edit on a shared chat) -->
							<div class="flex items-center gap-1">
								<Tooltip.Provider delayDuration={100}>
									<Tooltip.Root>
										<Tooltip.Trigger>
											{#snippet child({ props })}
												<Button
													{...props}
													variant="ghost"
													size="icon"
													class="h-6 w-6 cursor-pointer text-white/40 hover:bg-white/10 hover:text-white"
													onclick={() => copyToClipboard(turn.question, `q-${i}`)}
													aria-label="Copy question"
												>
													{#if copiedMessageId === `q-${i}`}
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
											<p>{copiedMessageId === `q-${i}` ? 'Copied!' : 'Copy question'}</p>
										</Tooltip.Content>
									</Tooltip.Root>
								</Tooltip.Provider>
							</div>
						</div>
					</div>

					<!-- Assistant Response (Flat & Clean — same as chat page) -->
					<div class="flex w-full justify-start py-2">
						<div class="flex w-full flex-col gap-3">
							<!-- Markdown Content View -->
							<div
								role="none"
								class="prose prose-sm max-w-none text-white/90 prose-invert prose-headings:font-semibold prose-headings:text-white prose-p:leading-relaxed prose-a:text-white/90 prose-a:underline hover:prose-a:text-white prose-code:rounded prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-white/90 prose-code:before:content-none prose-code:after:content-none prose-pre:my-3 prose-pre:border prose-pre:border-white/10 prose-pre:bg-black/50 prose-li:my-1 prose-tr:border-b prose-tr:border-white/10 prose-th:border-b prose-th:border-white/20 prose-td:border-b prose-td:border-white/10 prose-hr:my-4 prose-hr:border-white/10"
							>
								{#if turn.answer}
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									{@html renderMarkdown(turn.answer, turn.contextReferences)}
								{:else}
									<div
										class="flex animate-pulse items-center gap-2 py-1 text-xs font-medium text-white/60 italic select-none"
									>
										<span>Awaiting response…</span>
									</div>
								{/if}
							</div>

							<!-- Terminal Status Marker (stopped / failed / blocked) -->
							{#if turn.status === 'stopped'}
								<div
									class="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/50"
								>
									<Square class="size-3" />
									<span>Response Stopped</span>
								</div>
							{:else if turn.status === 'failed'}
								<div
									class="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/50"
								>
									<TriangleAlert class="size-3" />
									<span>Response failed</span>
								</div>
							{:else if turn.status === 'blocked'}
								<div
									class="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/50"
								>
									<ShieldAlert class="size-3" />
									<span>Response blocked by security filter</span>
								</div>
							{/if}

							<!-- Document Reference Chips (static — no document preview) -->
							{#if refsOf(turn).length > 0}
								<div class="mt-2 border-t border-white/10 pt-3">
									<div class="mb-2 flex items-center gap-1.5 text-xs font-medium text-white/60">
										<BookOpen class="size-3.5 text-white/60" />
										<span>Source References ({refsOf(turn).length})</span>
									</div>
									<div class="flex flex-wrap gap-2">
										{#each refsOf(turn) as ref (ref.id)}
											<Tooltip.Provider delayDuration={100}>
												<Tooltip.Root>
													<Tooltip.Trigger
														class="flex items-center gap-1.5 rounded-full border border-white/15 bg-[#2B2A29] px-3 py-1 text-xs text-white/80"
													>
														<FileText class="size-3 text-white/60" />
														<span class="font-medium">{ref.name}</span>
														{#if ref.pages && ref.pages.length > 0}
															<span class="text-white/40">• {ref.pages.join(', ')}</span>
														{/if}
													</Tooltip.Trigger>
													<Tooltip.Content
														class="max-w-xs rounded-md border-0 bg-white px-3 py-1.5 text-xs text-black shadow-md"
													>
														<p class="font-semibold text-black">{ref.name}</p>
														{#if ref.snippet}
															<p class="mt-1 text-black/70 italic">"{ref.snippet}"</p>
														{/if}
													</Tooltip.Content>
												</Tooltip.Root>
											</Tooltip.Provider>
										{/each}
									</div>
								</div>
							{/if}

							<!-- Action Toolbar (Copy only — no retry/feedback/dropdown on a shared chat) -->
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
														class="h-7 w-7 cursor-pointer text-white/40 hover:bg-white/10 hover:text-white"
														onclick={() => copyToClipboard(turn.answer, `a-${i}`)}
														aria-label="Copy response"
													>
														{#if copiedMessageId === `a-${i}`}
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
												<p>{copiedMessageId === `a-${i}` ? 'Copied!' : 'Copy response'}</p>
											</Tooltip.Content>
										</Tooltip.Root>
									</Tooltip.Provider>
								</div>
							</div>
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</main>

	<!-- ================= Floating Bottom Bar (same capsule style as the chat composer) ================= -->
	{#if share && !isLoading}
		<div
			class="pointer-events-none absolute right-0 bottom-0 left-0 z-30 flex flex-col items-center justify-end bg-gradient-to-t from-[#1F1E1D] via-[#1F1E1D]/90 to-transparent pt-6 pb-4"
			style="font-family: 'Inter', sans-serif;"
		>
			<div class="pointer-events-auto flex w-full max-w-4xl flex-col items-center gap-3 px-4">
				<div
					class="flex w-full items-center justify-between gap-3 rounded-[24px] border border-white/[0.16] bg-[#232323]/[0.85] px-4 py-2.5 shadow-2xl backdrop-blur-[42px] transition-all"
				>
					<div class="flex min-w-0 flex-col gap-0.5">
						<p class="truncate text-xs text-white/60">
							Shared read-only via Dokyudo — {turnLabel}, excluding any further conversation.
						</p>
						<p class="truncate text-[11px] text-white/40">{footerHint}</p>
					</div>
					<Button
						class="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-amber-500 px-4 text-sm font-medium text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
						disabled={isContinuing}
						onclick={handleContinue}
					>
						{#if isContinuing}
							<Spinner class="size-3.5" />
							Preparing...
						{:else}
							<GitBranch class="size-4" />
							Continue chat
						{/if}
					</Button>
				</div>
			</div>
		</div>
	{/if}
</div>
