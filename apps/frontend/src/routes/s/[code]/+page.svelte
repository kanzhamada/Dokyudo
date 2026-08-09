<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { Copy, Check, Lock, MessageSquare, User, GitBranch, Clock, Share2 } from 'lucide-svelte';
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

	function escapeHtml(value: string): string {
		return value
			.replace(/&/g, '&amp;')
			.replace(/"/g, '&quot;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
	}

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

	/**
	 * Read-only citation chips: show document title + pages from the snapshot.
	 * No preview links — public viewers have no access to the documents.
	 */
	function transformCitationTags(
		html: string,
		references?: PublicShareTurn['contextReferences']
	): string {
		if (!references || references.length === 0) {
			return html.replace(/\s*\[Doc [^\]]+\]/gi, '');
		}

		const isNegativeAnswer =
			/(Mohon maaf|tidak mengandung informasi|tidak ditemukan|tidak ada informasi|does not contain|cannot answer|no information available)/i.test(
				html
			);
		if (isNegativeAnswer) return html.replace(/\s*\[Doc [^\]]+\]/gi, '');

		let result = html.replace(/\[Doc \d+:[^\]]*;[^\]]*\]/gi, '');
		result = result.replace(
			/\[Doc (\d+)(?::\s*(?:Hlm\.|Pages?|Page)?\s*([^\]]+))?\]/gi,
			(_match, docIdxStr, rawPageInfo) => {
				const docIdx = Number(docIdxStr);
				const refDoc = references.find((r) => r.index === docIdx) ?? references[docIdx - 1];
				const docDisplayName = refDoc?.title
					? refDoc.title.replace(/\.[^/.]+$/, '')
					: `Doc ${docIdx}`;
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
			return transformCitationTags(marked.parse(text) as string, references);
		} catch {
			return text;
		}
	}

	const code = $derived(page.params.code ?? '');
	let share = $state<PublicShare | null>(null);
	let isLoading = $state(true);
	let notFound = $state(false);
	let isContinuing = $state(false);
	let copiedTurnId = $state<string | null>(null);
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

	// Mount code-block previews whenever the share content renders.
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

	async function copyTurn(turnId: string, text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copiedTurnId = turnId;
			setTimeout(() => {
				if (copiedTurnId === turnId) copiedTurnId = null;
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

	function turnLabel(turnId: string): string {
		return `turn-${turnId}`;
	}
</script>

<svelte:head>
	<title>{share ? `${share.title} — Dokyudo` : 'Dokyudo'}</title>
</svelte:head>

<div class="flex min-h-svh flex-col bg-[#141414] text-white">
	<!-- Header -->
	<header class="sticky top-0 z-20 border-b border-white/10 bg-[#141414]/90 backdrop-blur">
		<div class="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-3 px-4">
			<a href="/" class="flex min-w-0 items-center gap-2">
				<img src={favicon} alt="Dokyudo" class="h-6 w-auto" />
				<span class="truncate font-sans text-sm font-medium tracking-tight text-white/80">
					Dokyudo
				</span>
			</a>

			{#if share}
				<div class="flex min-w-0 items-center gap-2">
					<span
						class="flex shrink-0 items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/60"
					>
						<Lock class="size-3 text-white/50" />
						Read-only
					</span>
					<span
						class="hidden shrink-0 items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white/60 sm:flex"
					>
						<Clock class="size-3 text-white/50" />
						{formatExpiry(share.expiresAt)}
					</span>
				</div>
			{/if}
		</div>
	</header>

	<main class="shared-chat-body mx-auto w-full max-w-3xl flex-1 px-4 py-6">
		{#if isLoading}
			<div class="flex items-center justify-center py-24">
				<Spinner class="size-5 text-white/40" />
			</div>
		{:else if notFound}
			<div class="flex flex-col items-center justify-center gap-3 py-24 text-center">
				<Share2 class="size-8 text-white/25" />
				<h1 class="text-lg font-semibold">Link tidak valid atau sudah kedaluwarsa</h1>
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
			<!-- Conversation header -->
			<div class="mb-6">
				<h1 class="text-xl font-semibold tracking-tight">{share.title}</h1>
				<p class="mt-1 text-xs text-white/40">
					Dibagikan {new Date(share.createdAt).toLocaleDateString('id-ID', {
						day: 'numeric',
						month: 'short',
						year: 'numeric'
					})}
					· {share.turns.length} turn
				</p>

				<div class="mt-4 flex items-center gap-3">
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
			</div>

			<!-- Turns -->
			<div class="space-y-5">
				{#each share.turns as turn, i (turnLabel(turn.createdAt + i))}
					<!-- User question -->
					<div class="flex items-start gap-3">
						<div
							class="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5"
						>
							<User class="size-3.5 text-white/50" />
						</div>
						<div class="min-w-0 flex-1">
							<div class="group flex items-start justify-between gap-2">
								<p class="text-[15px] leading-relaxed whitespace-pre-wrap text-white/90">
									{turn.question}
								</p>
								<button
									type="button"
									class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-white/30 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/10 hover:text-white"
									onclick={() => copyTurn(`q-${i}`, turn.question)}
									aria-label="Salin prompt"
								>
									{#if copiedTurnId === `q-${i}`}
										<Check class="size-3.5 text-emerald-400" />
									{:else}
										<Copy class="size-3.5" />
									{/if}
								</button>
							</div>
						</div>
					</div>

					<!-- Assistant answer -->
					<div class="flex items-start gap-3">
						<div
							class="flex size-7 shrink-0 items-center justify-center rounded-full border border-amber-400/20 bg-amber-400/10"
						>
							<MessageSquare class="size-3.5 text-amber-300/80" />
						</div>
						<div class="min-w-0 flex-1">
							<div class="mb-1 flex items-center gap-2">
								<span class="text-xs font-medium text-white/50">
									{turn.modelUsed ?? 'Dokyudo AI'}
								</span>
								{#if turn.status === 'stopped' || turn.status === 'failed'}
									<span
										class="rounded-full border border-red-400/20 bg-red-400/10 px-2 py-0.5 text-[10px] font-medium text-red-300/80"
									>
										{turn.status === 'stopped' ? 'Dihentikan' : 'Gagal'}
									</span>
								{/if}
							</div>
							<div class="group relative">
								<div
									class="markdown-body rounded-xl border border-white/10 bg-[#1D1C1B] px-4 py-3 text-[15px] leading-relaxed text-white/85"
								>
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									{@html renderMarkdown(turn.answer, turn.contextReferences)}
								</div>
								<button
									type="button"
									class="absolute top-2 right-2 flex size-7 cursor-pointer items-center justify-center rounded-md bg-[#1D1C1B] text-white/30 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/10 hover:text-white"
									onclick={() => copyTurn(`a-${i}`, turn.answer)}
									aria-label="Salin respons"
								>
									{#if copiedTurnId === `a-${i}`}
										<Check class="size-3.5 text-emerald-400" />
									{:else}
										<Copy class="size-3.5" />
									{/if}
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>

			<!-- Footer CTA -->
			<div class="mt-10 border-t border-white/10 pt-6 text-center">
				<p class="text-xs text-white/35">
					Dibagikan secara read-only via Dokyudo — {share.turns.length} turn, tidak termasuk percakapan
					selanjutnya.
				</p>
			</div>
		{/if}
	</main>
</div>

<style>
	.markdown-body :global(pre) {
		overflow-x: auto;
	}
	.markdown-body :global(p) {
		margin: 0.5rem 0;
	}
	.markdown-body :global(p:first-child) {
		margin-top: 0;
	}
	.markdown-body :global(p:last-child) {
		margin-bottom: 0;
	}
	.markdown-body :global(h1),
	.markdown-body :global(h2),
	.markdown-body :global(h3) {
		margin: 0.75rem 0 0.5rem;
		font-weight: 600;
		line-height: 1.3;
	}
	.markdown-body :global(ul),
	.markdown-body :global(ol) {
		padding-left: 1.25rem;
		margin: 0.5rem 0;
	}
	.markdown-body :global(li) {
		margin: 0.2rem 0;
	}
	.markdown-body :global(table) {
		width: 100%;
		border-collapse: collapse;
		margin: 0.75rem 0;
		font-size: 0.85rem;
	}
	.markdown-body :global(th),
	.markdown-body :global(td) {
		border: 1px solid rgba(255, 255, 255, 0.15);
		padding: 0.4rem 0.6rem;
		text-align: left;
	}
</style>
