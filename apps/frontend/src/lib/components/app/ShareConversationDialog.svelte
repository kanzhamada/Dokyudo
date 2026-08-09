<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import { Input } from '$lib/components/ui/input';
	import { Copy, Check, Share2, Trash2, Link2 } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { createShare, deleteAllShares, deleteShare, listShares } from '$lib/api/rag';
	import type { ShareListItem } from '$lib/types/rag.types';

	interface Props {
		open?: boolean;
		conversationId: string;
		onClose?: () => void;
		/** Fired after a share is created — lets the parent refresh share indicators. */
		onShared?: () => void;
		/** Fired after any share is revoked — lets the parent refresh share indicators. */
		onStopped?: () => void;
	}

	let { open = $bindable(false), conversationId, onClose, onShared, onStopped }: Props = $props();

	const EXPIRY_OPTIONS: { label: string; hours: number | null }[] = [
		{ label: '1 jam', hours: 1 },
		{ label: '1 hari', hours: 24 },
		{ label: '1 minggu', hours: 168 },
		{ label: '1 bulan', hours: 720 },
		{ label: 'Tidak ada batas', hours: null }
	];

	let selectedExpiry = $state<number | null>(24);
	let customCode = $state('');
	let isCreating = $state(false);
	let isStoppingAll = $state(false);
	let shares = $state<ShareListItem[]>([]);
	let isLoadingShares = $state(false);
	let errorMessage = $state('');
	let copiedCode = $state<string | null>(null);

	let lastCreatedUrl = $state<string | null>(null);
	const origin = typeof window !== 'undefined' ? window.location.origin : '';

	const customCodeValid = $derived(/^[a-zA-Z0-9_-]{4,32}$/.test(customCode.trim()));
	const previewUrl = $derived(customCode.trim() ? `${origin}/s/${customCode.trim()}` : null);

	function handleClose() {
		open = false;
		onClose?.();
	}

	function shareUrlOf(code: string): string {
		return `${origin}/s/${code}`;
	}

	function formatExpiry(expiresAt: string | null): string {
		if (!expiresAt) return 'Tidak ada batas';
		return `Sampai ${new Date(expiresAt).toLocaleString('id-ID', {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		})}`;
	}

	async function loadShares() {
		isLoadingShares = true;
		try {
			const result = await listShares(conversationId);
			if (result.ok) {
				shares = result.data.shares;
			}
		} catch {
			// dialog stays usable even if the list fails
		} finally {
			isLoadingShares = false;
		}
	}

	async function handleCreate() {
		if (isCreating) return;
		errorMessage = '';

		const code = customCode.trim();
		if (code && !customCodeValid) {
			errorMessage = 'Custom link hanya boleh 4-32 karakter: huruf, angka, "-" atau "_".';
			return;
		}

		isCreating = true;
		try {
			const result = await createShare(conversationId, {
				...(selectedExpiry !== null ? { expiresInHours: selectedExpiry } : {}),
				...(code ? { customCode: code } : {})
			});
			if (result.ok) {
				lastCreatedUrl = shareUrlOf(result.data.code);
				customCode = '';
				toast.success('Link publik berhasil dibuat');
				onShared?.();
				await loadShares();
			} else {
				errorMessage =
					result.error.code === 'CODE_TAKEN'
						? 'Custom link tersebut sudah dipakai orang lain.'
						: result.error.message;
			}
		} catch {
			errorMessage = 'Gagal membuat link publik. Coba lagi.';
		} finally {
			isCreating = false;
		}
	}

	async function copyText(text: string, code: string) {
		try {
			await navigator.clipboard.writeText(text);
			copiedCode = code;
			toast.success('Link disalin');
			setTimeout(() => {
				if (copiedCode === code) copiedCode = null;
			}, 1500);
		} catch {
			toast.error('Gagal menyalin link');
		}
	}

	async function handleRevoke(code: string) {
		const result = await deleteShare(code);
		if (result.ok) {
			toast.success('Link publik dihentikan');
			onStopped?.();
			if (lastCreatedUrl?.endsWith(`/s/${code}`)) lastCreatedUrl = null;
			await loadShares();
		} else {
			toast.error(result.error.message);
		}
	}

	async function handleStopAll() {
		if (isStoppingAll) return;
		isStoppingAll = true;
		try {
			const result = await deleteAllShares(conversationId);
			if (result.ok) {
				toast.success('Semua link publik dihentikan');
				lastCreatedUrl = null;
				shares = [];
				onStopped?.();
			} else {
				toast.error(result.error.message);
			}
		} catch {
			toast.error('Gagal menghentikan link publik');
		} finally {
			isStoppingAll = false;
		}
	}

	$effect(() => {
		if (open) {
			lastCreatedUrl = null;
			errorMessage = '';
			loadShares();
		}
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="border-white/10 bg-[#232323] text-white sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2 text-lg font-semibold text-white">
				<Share2 class="size-4 text-white/60" />
				Share percakapan ke publik
			</Dialog.Title>
			<Dialog.Description class="text-sm text-white/45">
				Pembaca link hanya bisa melihat isi percakapan (read-only) — sampai turn terakhir saat link
				dibuat. Turn baru setelahnya tidak ikut tershare.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 px-6 pb-2">
			{#if errorMessage}
				<div
					class="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
				>
					{errorMessage}
				</div>
			{/if}

			<!-- Expiry -->
			<div>
				<p class="mb-2 text-xs font-medium text-white/60">Masa berlaku link</p>
				<div class="flex flex-wrap gap-2">
					{#each EXPIRY_OPTIONS as option}
						<button
							type="button"
							class="cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors
								{selectedExpiry === option.hours
								? 'border-amber-400/60 bg-amber-400/10 text-amber-200'
								: 'border-white/15 text-white/60 hover:border-white/30 hover:text-white'}"
							onclick={() => (selectedExpiry = option.hours)}
						>
							{option.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Custom URL -->
			<div>
				<p class="mb-2 text-xs font-medium text-white/60">Custom link (opsional)</p>
				<Input
					bind:value={customCode}
					placeholder="nama-kustom"
					class="border-white/15 bg-white/5 text-white placeholder:text-white/30 focus:border-amber-400/50"
				/>
				{#if previewUrl}
					<p class="mt-1 truncate font-mono text-[11px] text-white/40">{previewUrl}</p>
				{/if}
			</div>

			<!-- Create -->
			<Button
				class="w-full cursor-pointer bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50"
				disabled={isCreating}
				onclick={handleCreate}
			>
				{#if isCreating}
					<Spinner class="mr-2 size-4" />
					Membuat link...
				{:else}
					Buat link publik
				{/if}
			</Button>

			<!-- Newly created link -->
			{#if lastCreatedUrl}
				<div class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
					<p class="mb-1.5 text-[11px] font-medium text-emerald-300">Link berhasil dibuat</p>
					<div class="flex items-center gap-2">
						<code class="min-w-0 flex-1 truncate text-xs text-white/80">{lastCreatedUrl}</code>
						<button
							type="button"
							class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
							onclick={() => {
								if (lastCreatedUrl) copyText(lastCreatedUrl, lastCreatedUrl);
							}}
							aria-label="Salin link"
						>
							{#if copiedCode === lastCreatedUrl}
								<Check class="size-3.5 text-emerald-400" />
							{:else}
								<Copy class="size-3.5" />
							{/if}
						</button>
					</div>
				</div>
			{/if}

			<!-- Active shares -->
			{#if isLoadingShares}
				<div class="flex items-center justify-center py-3">
					<Spinner class="size-4 text-white/40" />
				</div>
			{:else if shares.length > 0}
				<div>
					<div class="mb-2 flex items-center justify-between">
						<p class="text-xs font-medium text-white/60">
							Link aktif ({shares.length})
						</p>
						<button
							type="button"
							class="cursor-pointer text-[11px] text-red-400/80 transition-colors hover:text-red-300 disabled:opacity-50"
							disabled={isStoppingAll}
							onclick={handleStopAll}
						>
							Hentikan semua
						</button>
					</div>
					<div class="max-h-40 space-y-1.5 overflow-y-auto pr-1">
						{#each shares as share}
							<div
								class="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2"
							>
								<Link2 class="size-3.5 shrink-0 text-white/40" />
								<div class="min-w-0 flex-1">
									<p class="truncate font-mono text-[11px] text-white/80">/s/{share.code}</p>
									<p class="text-[10px] text-white/40">{formatExpiry(share.expiresAt)}</p>
								</div>
								<button
									type="button"
									class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white"
									onclick={() => copyText(shareUrlOf(share.code), share.code)}
									aria-label="Salin link"
								>
									{#if copiedCode === share.code}
										<Check class="size-3.5 text-emerald-400" />
									{:else}
										<Copy class="size-3.5" />
									{/if}
								</button>
								<button
									type="button"
									class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-red-400/60 transition-colors hover:bg-red-500/10 hover:text-red-300"
									onclick={() => handleRevoke(share.code)}
									aria-label="Hentikan link ini"
								>
									<Trash2 class="size-3.5" />
								</button>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<Dialog.Footer class="mt-2">
			<Button
				variant="ghost"
				class="cursor-pointer text-white/60 hover:bg-white/10 hover:text-white"
				onclick={handleClose}
			>
				Tutup
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
