<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { Copy, Check, Lock } from 'lucide-svelte';
	import MxIcon from '$lib/components/icons/MxIcon.svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Spinner } from '$lib/components/ui/spinner';
	import { Button } from '$lib/components/ui/button';
	import CodeBlockPreview from '$lib/components/chat/CodeBlockPreview.svelte';
	import TurnStatusBadge from '$lib/components/chat/TurnStatusBadge.svelte';
	import SourceReferences from '$lib/components/chat/SourceReferences.svelte';
	import AttachmentCards from '$lib/components/chat/AttachmentCards.svelte';
	import { renderMarkdown } from '$lib/utils/markdown';
	import { splitMentionSegments, stripMentionTokens } from '$lib/utils/doc-mentions';
	import { continueShare, getPublicShare } from '$lib/api/rag';
	import MobileHeader from '$lib/components/app/MobileHeader.svelte';
	import { mobileHeaderState } from '$lib/state/mobile-header.svelte.js';
	import { sessionStore } from '$lib/state/session.store.svelte';
	import { toast } from 'svelte-sonner';
	import { mount, unmount, untrack } from 'svelte';
	import type { PublicShare, PublicShareTurn } from '$lib/types/rag.types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	import favicon from '$lib/assets/favicon.svg';
	import faviconRaw from '$lib/assets/favicon.svg?raw';

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
	const inviteToken = $derived(page.url.searchParams.get('invite') ?? undefined);
	let share = $state<PublicShare | null>(untrack(() => data.share));
	let isLoading = $state(!untrack(() => data.share));
	let notFound = $state(false);
	let isPrivateLocked = $state(false);
	let isContinuing = $state(false);
	let copiedMessageId = $state<string | null>(null);
	let codeBlockInstances: { el: HTMLElement; unmount: () => void }[] = [];

	const isSignedIn = $derived(sessionStore.authenticated);
	const footerHint = $derived(
		isSignedIn
			? 'Continue in your private chat (a copy of this link).'
			: 'Sign in to continue this chat in your account.'
	);
	let copiedLink = $state(false);
	const shareUrl = $derived(
		inviteToken
			? `${page.url.origin}/s/${code}?invite=${inviteToken}`
			: `${page.url.origin}/s/${code}`
	);
	const ogImageUrl = $derived(
		`${page.url.origin}/s/${code}/opengraph-image.svg${inviteToken ? `?invite=${encodeURIComponent(inviteToken)}` : ''}`
	);
	const metaTitle = $derived(share ? `${share.title} — Dokyudo` : 'Shared conversation — Dokyudo');
	const metaDescription = $derived(
		share
			? `A shared ${share.isPrivate ? 'private ' : ''}conversation by ${share.authorName || 'a Dokyudo user'}.`
			: 'A shared conversation on Dokyudo.'
	);

	onMount(() => {
		if (!share) loadShare();
		return () => {
			codeBlockInstances.forEach((i) => i.unmount());
			codeBlockInstances = [];
		};
	});

	async function loadShare() {
		isLoading = true;
		notFound = false;
		isPrivateLocked = false;
		share = null;
		const result = await getPublicShare(code, inviteToken);
		if (result.ok) {
			share = result.data;
		} else {
			if (result.error.code === 'PRIVATE_SHARE') {
				isPrivateLocked = true;
			} else {
				notFound = true;
			}
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
			toast.success(title, { description: msg || undefined });
		}
	}

	function showInfo(title: string, msg: string = '') {
		if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
			mobileHeaderState.showInfo(title, msg);
		} else {
			toast.info(title, { description: msg || undefined });
		}
	}

	async function copyToClipboard(text: string, id: string) {
		// Strip inline citation tags ([Doc N: Page X]) and document mention tokens (e.g. @[title](id))
		// so copied questions or answers don't carry source reference markers or mention tokens.
		const cleanText = stripMentionTokens(text.replace(/\s*\[Doc [^\]]+\]/gi, '')).trim();
		try {
			await navigator.clipboard.writeText(cleanText);
			copiedMessageId = id;
			showSuccess('Copied to clipboard');
			setTimeout(() => {
				if (copiedMessageId === id) copiedMessageId = null;
			}, 2000);
		} catch {
			showError('Failed to copy to clipboard');
		}
	}

	/** Copies the current share page URL (header share button). */
	async function copyShareLink() {
		try {
			await navigator.clipboard.writeText(window.location.href);
			copiedLink = true;
			showSuccess('Share link copied to clipboard');
			setTimeout(() => {
				copiedLink = false;
			}, 1500);
		} catch {
			showError('Failed to copy share link');
		}
	}

	async function handleContinue() {
		if (isContinuing || !share) return;
		if (!sessionStore.authenticated) {
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
				showError('Failed to continue chat');
			}
		} catch {
			showError('Failed to continue chat');
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
	<title>{metaTitle}</title>
	<meta name="description" content={metaDescription} />
	<meta property="og:type" content="article" />
	<meta property="og:site_name" content="Dokyudo" />
	<meta property="og:title" content={metaTitle} />
	<meta property="og:description" content={metaDescription} />
	<meta property="og:url" content={shareUrl} />
	<meta property="og:image" content={ogImageUrl} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={metaTitle} />
	<meta name="twitter:description" content={metaDescription} />
	<meta name="twitter:image" content={ogImageUrl} />
</svelte:head>

<div class="relative flex h-svh w-full flex-col overflow-hidden bg-[#1F1E1D]">
	<!-- Ambient Background Glow Circle (Matching App Shell Layout) -->
	<div
		class="pointer-events-none absolute -top-[318px] -left-[295px] z-0 h-[1190px] w-[1190px] rounded-full opacity-[0.07]"
		style="background: linear-gradient(180deg, #ffffff 0%, #4b3117 100%); filter: blur(99px);"
	></div>

	<!-- ================= Mobile Header (reusable MobileHeader capsule) ================= -->
	<MobileHeader>
		{#snippet leading()}
			<a
				href="/"
				class="flex shrink-0 items-center gap-0.5 rounded-lg text-white transition-opacity hover:opacity-85"
				aria-label="Dokyudo home"
			>
				<div class="flex items-center [&_path]:fill-white [&>svg]:size-6">
					{@html faviconRaw}
				</div>
				<span class="font-geist text-lg font-bold tracking-tight text-white">okyudo</span>
			</a>
		{/snippet}

		{#snippet center()}
			<div class="flex max-w-[45%] min-w-0 items-center justify-center px-2">
				<span
					class="max-w-full truncate text-xs font-medium text-white/75"
					title={share?.title ?? 'Shared conversation'}
				>
					{share?.title ?? 'Shared conversation'}
				</span>
			</div>
		{/snippet}

		{#snippet trailing()}
			<Tooltip.Provider delayDuration={100}>
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<button
								{...props}
								type="button"
								class="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-white/55 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-90 active:bg-white/20 active:text-white"
								onclick={copyShareLink}
								aria-label="Copy share link"
							>
								{#if copiedLink}
									<Check class="size-4 text-green-400" />
								{:else}
									<MxIcon name="share-outline" class="size-4" />
								{/if}
							</button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content
						class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
					>
						<p>{copiedLink ? 'Copied!' : 'Copy link'}</p>
					</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
		{/snippet}
	</MobileHeader>

	<!-- ================= Desktop Header (Gradient Bar — same as chat page) ================= -->
	<div
		class="pointer-events-none absolute top-0 right-0 left-0 z-20 hidden h-28 bg-gradient-to-b from-[#1F1E1D] via-[#1F1E1D]/95 via-65% to-transparent md:block"
	>
		<div class="pointer-events-auto grid h-16 w-full grid-cols-3 items-center px-4 md:px-8">
			<div class="flex justify-start">
				<a
					href="/"
					class="flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-white/55 transition-colors hover:bg-white/10 hover:text-white"
				>
					<img src={favicon} alt="Dokyudo" class="h-5 w-auto" />
					<span class="font-sans font-medium tracking-tight">okyudo</span>
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
				<Tooltip.Provider delayDuration={100}>
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<button
									{...props}
									type="button"
									class="flex size-8 cursor-pointer items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/10 hover:text-white"
									onclick={copyShareLink}
									aria-label="Copy share link"
								>
									{#if copiedLink}
										<Check class="size-4 text-green-400" />
									{:else}
										<MxIcon name="share-outline" class="size-4" />
									{/if}
								</button>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content
							class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
						>
							<p>{copiedLink ? 'Copied!' : 'Copy link'}</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>
			</div>
		</div>
	</div>

	<!-- ================= Main Content ================= -->
	<main
		class="relative z-10 flex min-h-0 flex-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent flex-col overflow-y-auto px-4 pt-24 md:px-8 md:pt-28"
	>
		<div class="mx-auto flex w-full max-w-4xl flex-col space-y-6 pb-32">
			{#if isLoading}
				<div class="flex flex-1 items-center justify-center py-24">
					<Spinner class="size-5 text-white/40" />
				</div>
			{:else if isPrivateLocked}
				<div class="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
					<Lock class="size-8 text-white/25" />
					<h1 class="text-lg font-semibold text-white">This link is private</h1>
					<p class="max-w-sm text-sm text-white/45">
						Only people invited by the owner can view this conversation.
					</p>
					<Button
						class="mt-2 cursor-pointer bg-amber-500 text-black hover:bg-amber-400"
						onclick={() => goto('/')}
					>
						Go to home
					</Button>
				</div>
			{:else if notFound}
				<div class="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
					<MxIcon name="share-outline" class="size-8 text-white/25" />
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
							<span>{share.isPrivate ? 'Private share' : 'Read-only share'}</span>
						</span>
						<span class="text-xs text-white/40">
							By {share.authorName || 'Dokyudo user'} · Shared {formatSharedDate(share.createdAt)}
						</span>
					</div>
				</div>

				{#each share.turns as turn, i (turn.createdAt + i)}
					<!-- User Message (Clean Pill — same as chat page) -->
					<div class="flex w-full justify-end">
						<div class="flex max-w-[85%] flex-col items-end gap-1.5 md:max-w-[70%]">
							<!-- Attached documents (title only — static cards, not openable: public viewers have no document access, by design). -->
							{#if turn.attachments && turn.attachments.length > 0}
								<AttachmentCards
									attachments={turn.attachments.map((a) => ({
										name: a.title,
										documentId: a.documentId
									}))}
								/>
							{/if}
							<div
								class="w-fit rounded-2xl border border-white/15 bg-[#2B2A29] px-4 py-3 text-sm text-white/90 shadow-md backdrop-blur-md"
							>
								<p class="leading-relaxed whitespace-pre-wrap">
									{#each splitMentionSegments(turn.question) as seg}
										{#if seg.type === 'mention'}
											<span
												class="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 align-baseline text-[11px] leading-none font-medium text-white/80"
											>
												<MxIcon name="document-outline" class="size-3 text-white/60" />
												{seg.title}
											</span>
										{:else}
											<span>{seg.text}</span>
										{/if}
									{/each}
								</p>
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
									{@html renderMarkdown(turn.answer, turn.contextReferences, false)}
								{:else}
									<div
										class="flex animate-pulse items-center gap-2 py-1 text-xs font-medium text-white/60 italic select-none"
									>
										<span>Awaiting response…</span>
									</div>
								{/if}
							</div>

							<!-- Terminal Status Marker (stopped / failed / blocked) -->
							<TurnStatusBadge status={turn.status} />

							<!-- Document Reference Chips (static — no document preview) -->
							{#if refsOf(turn).length > 0}
								<SourceReferences references={refsOf(turn)} />
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
						<p class="truncate text-xs text-white/60">Shared read-only via Dokyudo.</p>
						<p class="truncate text-[11px] text-white/40">{footerHint}</p>
					</div>
					<Button
						class="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-[#DB8F5E] px-4 text-sm font-medium text-black hover:bg-[#E39B6D] disabled:cursor-not-allowed disabled:opacity-40"
						disabled={isContinuing}
						onclick={handleContinue}
					>
						{#if isContinuing}
							<Spinner class="size-3.5" />
							Preparing...
						{:else}
							Continue chat
						{/if}
					</Button>
				</div>
			</div>
		</div>
	{/if}
</div>
