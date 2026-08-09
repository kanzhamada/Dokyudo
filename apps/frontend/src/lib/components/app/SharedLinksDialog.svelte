<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import { Check, Copy, ExternalLink, Link2, RefreshCw, Search, Trash2 } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { deleteAllTenantShares, deleteShare, listAllShares } from '$lib/api/rag';
	import type { ShareListItem } from '$lib/types/rag.types';

	const PAGE_SIZE = 10;

	interface Props {
		open?: boolean;
		onClose?: () => void;
	}

	let { open = $bindable(false), onClose }: Props = $props();

	const origin = typeof window !== 'undefined' ? window.location.origin : '';
	let shares = $state<ShareListItem[]>([]);
	let isLoading = $state(false);
	let isDeletingAll = $state(false);
	let errorMessage = $state('');
	let copiedCode = $state<string | null>(null);
	let searchQuery = $state('');
	let currentPage = $state(1);

	const filteredShares = $derived.by(() => {
		const query = searchQuery.trim().toLowerCase();
		if (!query) return shares;
		return shares.filter(
			(share) =>
				share.title.toLowerCase().includes(query) || share.code.toLowerCase().includes(query)
		);
	});

	const totalPages = $derived(Math.max(1, Math.ceil(filteredShares.length / PAGE_SIZE)));
	const pageShares = $derived(
		filteredShares.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
	);

	function setSearchQuery(value: string) {
		searchQuery = value;
		currentPage = 1;
	}

	function shareUrl(code: string): string {
		return `${origin}/s/${code}`;
	}

	function openLink(code: string) {
		window.open(shareUrl(code), '_blank', 'noopener,noreferrer');
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatExpiry(expiresAt: string | null): string {
		return expiresAt ? `Expires ${formatDate(expiresAt)}` : 'No expiry';
	}

	async function loadShares() {
		isLoading = true;
		errorMessage = '';
		try {
			const result = await listAllShares();
			if (result.ok) {
				shares = result.data.shares;
			} else {
				errorMessage = 'Unable to load shared links.';
			}
		} catch {
			errorMessage = 'Unable to load shared links.';
		} finally {
			isLoading = false;
		}
	}

	async function revokeAll() {
		if (isDeletingAll || shares.length === 0) return;
		isDeletingAll = true;
		try {
			const result = await deleteAllTenantShares();
			if (result.ok) {
				shares = [];
				searchQuery = '';
				currentPage = 1;
				toast.success('All shared links revoked');
			} else {
				toast.error(result.error.message);
			}
		} catch {
			toast.error('Unable to revoke shared links');
		} finally {
			isDeletingAll = false;
		}
	}

	async function copyLink(code: string) {
		try {
			await navigator.clipboard.writeText(shareUrl(code));
			copiedCode = code;
			setTimeout(() => {
				if (copiedCode === code) copiedCode = null;
			}, 1600);
		} catch {
			toast.error('Unable to copy the link');
		}
	}

	async function revokeLink(code: string) {
		const result = await deleteShare(code);
		if (result.ok) {
			shares = shares.filter((share) => share.code !== code);
			toast.success('Shared link revoked');
		} else {
			toast.error(result.error.message);
		}
	}

	$effect(() => {
		if (open) void loadShares();
	});
</script>

<Dialog.Root
	bind:open
	onOpenChange={(nextOpen) => {
		if (!nextOpen) onClose?.();
	}}
>
	<Dialog.Content
		showCloseButton={true}
		class="max-h-[min(680px,calc(100vh-2rem))] gap-0 overflow-y-auto rounded-[18px] border border-white/[0.1] bg-[#242322] p-0 text-white shadow-2xl shadow-black/40 sm:max-w-[560px]"
	>
		<Dialog.Header class="border-b border-white/[0.09] px-5 py-4 pr-14">
			<Dialog.Title
				class="flex items-center gap-2 text-[17px] font-medium tracking-[-0.02em] text-white"
			>
				<Link2 class="size-[15px] text-white/55" strokeWidth={1.8} />
				Shared links
			</Dialog.Title>
			<Dialog.Description class="mt-1 text-xs leading-5 text-white/45">
				Manage the active links you have created.
			</Dialog.Description>
		</Dialog.Header>

		<div class="px-5 py-4">
			<div class="mb-3 flex items-center justify-between gap-3">
				<p class="text-xs font-medium text-white/55">
					{shares.length} active {shares.length === 1 ? 'link' : 'links'}
				</p>
				<div class="flex items-center gap-1">
					<button
						type="button"
						class="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white disabled:pointer-events-none disabled:opacity-40"
						disabled={isLoading}
						onclick={() => loadShares()}
					>
						<RefreshCw class="size-3 {isLoading ? 'animate-spin' : ''}" strokeWidth={1.8} />
						Refresh
					</button>
					{#if shares.length > 0}
						<button
							type="button"
							class="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-red-400/80 transition-colors hover:bg-red-500/[0.1] hover:text-red-300 disabled:pointer-events-none disabled:opacity-40"
							disabled={isDeletingAll}
							onclick={revokeAll}
						>
							{#if isDeletingAll}
								<RefreshCw class="size-3 animate-spin" strokeWidth={1.8} />
							{:else}
								<Trash2 class="size-3" strokeWidth={1.8} />
							{/if}
							Delete all
						</button>
					{/if}
				</div>
			</div>

			{#if shares.length > 0}
				<div class="relative mb-3">
					<Search
						class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/35"
						strokeWidth={1.8}
					/>
					<input
						type="text"
						value={searchQuery}
						oninput={(event) => setSearchQuery(event.currentTarget.value)}
						placeholder="Search by title or code"
						aria-label="Search shared links"
						class="h-10 w-full rounded-lg border border-white/[0.12] bg-white/[0.055] pl-9 text-sm text-white placeholder:text-white/28 focus:border-white/30 focus:ring-2 focus:ring-white/10 focus:outline-none"
					/>
				</div>
			{/if}

			{#if isLoading && shares.length === 0}
				<div class="flex items-center justify-center py-16">
					<Spinner class="size-5 text-white/40" />
				</div>
			{:else if errorMessage}
				<div class="flex flex-col items-center gap-3 py-12 text-center">
					<p class="text-sm text-white/55">{errorMessage}</p>
					<Button
						variant="outline"
						class="border-white/[0.15] bg-transparent text-xs text-white/75 hover:bg-white/[0.08] hover:text-white"
						onclick={() => loadShares()}
					>
						Try again
					</Button>
				</div>
			{:else if shares.length === 0}
				<div class="flex flex-col items-center gap-2 py-16 text-center">
					<Link2 class="size-6 text-white/20" strokeWidth={1.5} />
					<p class="text-sm text-white/60">No active shared links</p>
					<p class="max-w-xs text-xs leading-5 text-white/35">
						Links you create from a conversation will appear here.
					</p>
				</div>
			{:else if filteredShares.length === 0}
				<div class="flex flex-col items-center gap-2 py-16 text-center">
					<Search class="size-6 text-white/20" strokeWidth={1.5} />
					<p class="text-sm text-white/60">No shared links match your search</p>
					<p class="max-w-xs text-xs leading-5 text-white/35">
						Try a different title or link code.
					</p>
				</div>
			{:else}
				<div class="divide-y divide-white/[0.09] border-y border-white/[0.09]">
					{#each pageShares as share (share.code)}
						<div class="flex items-center gap-3 py-3">
							<div
								class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.07]"
							>
								<Link2 class="size-3.5 text-white/45" strokeWidth={1.8} />
							</div>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm text-white/80">{share.title}</p>
								<p class="mt-0.5 truncate font-mono text-[10px] text-white/35">
									{shareUrl(share.code)}
								</p>
								<p class="mt-1 text-[10px] text-white/35">
									Created {formatDate(share.createdAt)} · {formatExpiry(share.expiresAt)}
								</p>
							</div>
							<div class="flex shrink-0 items-center gap-0.5">
								<button
									type="button"
									aria-label={`Open ${share.title}`}
									class="flex size-8 cursor-pointer items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white"
									onclick={() => openLink(share.code)}
								>
									<ExternalLink class="size-3.5" strokeWidth={1.8} />
								</button>
								<button
									type="button"
									class="flex size-8 cursor-pointer items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white"
									aria-label={`Copy ${share.title}`}
									onclick={() => copyLink(share.code)}
								>
									{#if copiedCode === share.code}
										<Check class="size-3.5 text-emerald-300" strokeWidth={2} />
									{:else}
										<Copy class="size-3.5" strokeWidth={1.8} />
									{/if}
								</button>
								<button
									type="button"
									class="flex size-8 cursor-pointer items-center justify-center rounded-md text-white/35 transition-colors hover:bg-red-500/[0.1] hover:text-red-300"
									aria-label={`Revoke ${share.title}`}
									onclick={() => revokeLink(share.code)}
								>
									<Trash2 class="size-3.5" strokeWidth={1.8} />
								</button>
							</div>
						</div>
					{/each}
				</div>

				{#if totalPages > 1}
					<div class="mt-3 flex items-center justify-between gap-3">
						<button
							type="button"
							class="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white disabled:pointer-events-none disabled:opacity-40"
							disabled={currentPage <= 1}
							onclick={() => (currentPage -= 1)}
						>
							Previous
						</button>
						<span class="text-[11px] text-white/40">
							Page {currentPage} of {totalPages}
						</span>
						<button
							type="button"
							class="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white disabled:pointer-events-none disabled:opacity-40"
							disabled={currentPage >= totalPages}
							onclick={() => (currentPage += 1)}
						>
							Next
						</button>
					</div>
				{/if}
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>
