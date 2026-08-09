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
		if (!expiresAt) return 'Tidak ada batas waktu';
		return `Kedaluwarsa ${new Date(expiresAt).toLocaleString('id-ID', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		})}`;
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

	<!-- Floating Conversation Capsule (same visual as the chat page header) -->
	<div
		class="pointer-events-auto absolute top-3 right-3 left-3 z-30 overflow-hidden rounded-[24px] border border-white/15 bg-[#232323]/90 shadow-2xl backdrop-blur-[42px]"
	>
		<div class="flex h-14 items-center justify-between px-3">
			<!-- Brand -->
			<a href="/" class="flex shrink-0 items-center gap-1.5" aria-label="Dokyudo beranda">
				<img src={favicon} alt="Dokyudo" class="h-6 w-auto" />
				<span class="hidden font-sans text-sm font-medium tracking-tight text-white/80 sm:block">
					Dokyudo
				</span>
			</a>

			<!-- Shared conversation title -->
			<div class="flex min-w-0 flex-1 items-center justify-center px-2">
				<span class="max-w-full truncate text-xs font-medium text-white/75" title={share?.title}>
					{share?.title ?? 'Shared conversation'}
				</span>
			</div>

			<!-- Share-specific actions -->
			<div class="flex shrink-0 items-center gap-1.5">
				<span
					class="hidden items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/60 sm:flex"
					title={share ? formatExpiry(share.expiresAt) : undefined}
				>
					<Clock class="size-3 text-white/50" />
					{share?.expiresAt ? 'Ada batas waktu' : 'Tanpa batas waktu'}
				</span>
				<Button
					size="sm"
					class="cursor-pointer border border-white/20 bg-white/15 text-xs font-medium text-white hover:bg-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
					disabled={isContinuing || !share}
					onclick={handleContinue}
				>
					{#if isContinuing}
						<Spinner class="mr-1.5 size-3" />
						Menyiapkan...
					{:else}
						<GitBranch class="mr-1.5 size-3.5" />
						Lanjutkan chat
					{/if}
				</Button>
			</div>
		</div>
	</div>

	<!-- Main Content -->
	<main
		class="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-24 md:px-8 md:pt-28"
	>
		<div class="mx-auto flex w-full max-w-4xl flex-col space-y-6 pb-28">
			{#if isLoading}
				<div class="flex flex-1 items-center justify-center py-24">
					<Spinner class="size-5 text-white/40" />
				</div>
			{:else if notFound}
				<div class="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
					<Share2 class="size-8 text-white/25" />
					<h1 class="text-lg font-semibold text-white">Link tidak valid atau sudah kedaluwarsa</h1>
					<p class="max-w-sm text-sm text-white/45">
						Link publik ini sudah dihentikan oleh pemiliknya, atau masa berlakunya sudah habis.
					</p>
					<Button
						class="mt-2 cursor-pointer bg-amber-500 text-black hover:bg-amber-400"
						onclick={() => goto('/')}
					>
						Ke beranda
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
							Dibagikan {new Date(share.createdAt).toLocaleDateString('id-ID', {
								day: 'numeric',
								month: 'short',
								year: 'numeric'
							})}
							· {share.turns.length} turn
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
										<span>Menunggu respons…</span>
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

				<!-- Footer CTA -->
				<div class="flex flex-col items-center gap-3 border-t border-white/10 pt-6 text-center">
					<p class="text-xs text-white/35">
						Dibagikan secara read-only via Dokyudo — {share.turns.length} turn, tidak termasuk percakapan
						selanjutnya.
					</p>
					<Button
						class="cursor-pointer bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-60"
						onclick={handleContinue}
						disabled={isContinuing}
					>
						{#if isContinuing}
							<Spinner class="mr-2 size-4" />
							Menyiapkan chat...
						{:else}
							<GitBranch class="mr-2 size-4" />
							Lanjutkan chat ini
						{/if}
					</Button>
					<p class="text-xs text-white/40">
						{sessionStore.getAccessToken()
							? 'Lanjutkan di chat pribadi kamu (salinan dari link ini).'
							: 'Masuk dulu untuk melanjutkan chat ini di akunmu.'}
					</p>
				</div>
			{/if}
		</div>
	</main>
</div>
