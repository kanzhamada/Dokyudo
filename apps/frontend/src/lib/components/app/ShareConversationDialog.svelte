<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import { Input } from '$lib/components/ui/input';
	import { Check, Copy, Globe2, Link2, LockKeyhole, Mail, Share2, X } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { createShare } from '$lib/api/rag';

	interface Props {
		open?: boolean;
		conversationId: string;
		conversationTitle?: string;
		onClose?: () => void;
		/** Fired after a share is created — lets the parent refresh share indicators. */
		onShared?: () => void;
	}

	let {
		open = $bindable(false),
		conversationId,
		conversationTitle = 'Untitled conversation',
		onClose,
		onShared
	}: Props = $props();

	const EXPIRY_OPTIONS: { label: string; hours: number | null }[] = [
		{ label: '1 hour', hours: 1 },
		{ label: '1 day', hours: 24 },
		{ label: '1 month', hours: 720 },
		{ label: 'No expiry', hours: null }
	];

	type SocialNetwork = 'x' | 'facebook' | 'reddit' | 'linkedin';
	type ShareMode = 'public' | 'private';

	let selectedExpiry = $state<number | null>(24);
	let shareMode = $state<ShareMode>('public');
	let customCode = $state('');
	let isCreating = $state(false);
	let errorMessage = $state('');
	let copiedCode = $state<string | null>(null);
	let lastCreatedUrl = $state<string | null>(null);
	let lastCreatedCode = $state<string | null>(null);
	let recipientInput = $state('');
	let recipients = $state<string[]>([]);
	let notifyRecipients = $state(true);
	let inviteMessage = $state('');
	let rejectedCodes = $state(new Set<string>());

	const origin = typeof window !== 'undefined' ? window.location.origin : '';
	const customCodeValid = $derived(/^[a-zA-Z0-9_-]{4,32}$/.test(customCode.trim()));
	const isRejectedInput = $derived(
		customCode.trim().length > 0 && rejectedCodes.has(customCode.trim())
	);
	const previewUrl = $derived(customCode.trim() ? `${origin}/s/${customCode.trim()}` : null);
	const hasValidRecipients = $derived(recipients.length > 0);
	const ogImageUrl = $derived(
		lastCreatedCode ? `${origin}/s/${lastCreatedCode}/opengraph-image.svg` : null
	);
	const previewTitle = $derived(conversationTitle?.trim() || 'Untitled conversation');

	function shareUrlOf(code: string): string {
		return `${origin}/s/${code}`;
	}

	function resetDialogState() {
		customCode = '';
		shareMode = 'public';
		lastCreatedUrl = null;
		lastCreatedCode = null;
		errorMessage = '';
		inviteMessage = '';
		recipientInput = '';
		recipients = [];
		copiedCode = null;
	}

	function setShareMode(mode: ShareMode) {
		if (shareMode === mode) return;
		shareMode = mode;
		lastCreatedUrl = null;
		copiedCode = null;
		errorMessage = '';
		inviteMessage = '';
		recipientInput = '';
		recipients = [];
	}

	async function handleCreate() {
		if (isCreating) return;
		errorMessage = '';

		const code = customCode.trim();
		if (code && !customCodeValid) {
			errorMessage = 'Use 4–32 letters, numbers, hyphens, or underscores.';
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
				lastCreatedCode = result.data.code;
				customCode = '';
				onShared?.();
				const copied = await copyText(lastCreatedUrl, 'created');
				toast.success(copied ? 'Share link created and copied' : 'Share link created');
			} else {
				if (result.error.code === 'CODE_TAKEN' && code) rejectedCodes.add(code);
				errorMessage =
					result.error.code === 'CODE_TAKEN'
						? 'That custom link is already in use. Choose another one.'
						: result.error.message;
			}
		} catch {
			errorMessage = 'Unable to create the share link. Try again.';
		} finally {
			isCreating = false;
		}
	}

	async function copyText(text: string, code: string): Promise<boolean> {
		try {
			await navigator.clipboard.writeText(text);
			copiedCode = code;
			setTimeout(() => {
				if (copiedCode === code) copiedCode = null;
			}, 1600);
			return true;
		} catch {
			toast.error('Unable to copy the link');
			return false;
		}
	}

	function isValidEmail(email: string): boolean {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
	}

	function addRecipient() {
		const email = recipientInput.trim().replace(/,$/, '');
		if (!email) return;
		if (!isValidEmail(email)) {
			inviteMessage = 'Enter a valid email address.';
			return;
		}
		if (!recipients.includes(email)) recipients.push(email);
		recipientInput = '';
		inviteMessage = '';
	}

	function removeRecipient(email: string) {
		recipients = recipients.filter((recipient) => recipient !== email);
	}

	function handleRecipientKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ',') {
			event.preventDefault();
			addRecipient();
		}
	}

	function handleInvite() {
		if (!lastCreatedUrl) {
			inviteMessage = 'Create a link before inviting people.';
			return;
		}
		if (recipientInput.trim()) addRecipient();
		if (!hasValidRecipients) {
			inviteMessage = 'Add at least one email address.';
			return;
		}
		inviteMessage = '';
		toast.success(
			notifyRecipients ? 'Invite emails are ready to send' : 'Invite link is ready to share'
		);
	}

	function socialShareUrl(network: SocialNetwork): string | null {
		if (!lastCreatedUrl) return null;
		const encodedUrl = encodeURIComponent(lastCreatedUrl);
		if (network === 'x') return `https://twitter.com/intent/tweet?url=${encodedUrl}`;
		if (network === 'facebook') return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
		if (network === 'reddit') return `https://www.reddit.com/submit?url=${encodedUrl}`;
		return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
	}

	function openSocialShare(network: SocialNetwork) {
		const url = socialShareUrl(network);
		if (url) window.open(url, '_blank', 'noopener,noreferrer');
	}

	$effect(() => {
		if (open) {
			resetDialogState();
		}
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
		class="max-h-[min(720px,calc(100vh-2rem))] gap-0 overflow-y-auto rounded-[18px] border border-white/[0.1] bg-[#242322] p-0 text-white shadow-2xl shadow-black/40 sm:max-w-[520px]"
	>
		<Dialog.Header class="border-b border-white/[0.09] px-5 py-4 pr-14">
			<Dialog.Title
				class="flex items-center gap-2 text-[17px] font-medium tracking-[-0.02em] text-white"
			>
				<Share2 class="size-[15px] text-white/55" strokeWidth={1.8} />
				Share conversation
			</Dialog.Title>
			<Dialog.Description class="mt-1 text-xs leading-5 text-white/45">
				Create a link, invite specific people, or share it publicly.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-5 px-5 py-5">
			{#if errorMessage}
				<div
					class="rounded-lg border border-red-400/25 bg-red-400/[0.08] px-3 py-2 text-xs text-red-200"
				>
					{errorMessage}
				</div>
			{/if}

			<section aria-labelledby="expiry-heading" class="space-y-3">
				<div>
					<h2 id="expiry-heading" class="text-sm font-medium text-white/90">Link expiry</h2>
					<p class="mt-1 text-xs leading-5 text-white/42">Choose how long the link stays active.</p>
				</div>
				<div
					class="grid grid-cols-4 overflow-hidden rounded-lg border border-white/[0.12] bg-white/[0.035]"
				>
					{#each EXPIRY_OPTIONS as option (option.label)}
						<button
							type="button"
							aria-pressed={selectedExpiry === option.hours}
							class="min-h-9 border-r border-white/[0.1] px-2 text-[11px] text-white/48 transition-colors last:border-r-0 hover:bg-white/[0.06] hover:text-white/80 {selectedExpiry ===
							option.hours
								? 'bg-white/[0.1] text-white'
								: ''}"
							onclick={() => (selectedExpiry = option.hours)}
						>
							{option.label}
						</button>
					{/each}
				</div>
			</section>

			<section aria-labelledby="access-heading" class="space-y-3 border-t border-white/[0.09] pt-5">
				<div>
					<h2 id="access-heading" class="text-sm font-medium text-white/90">Share access</h2>
					<p class="mt-1 text-xs leading-5 text-white/42">
						{shareMode === 'public'
							? 'Anyone with the link can view this conversation.'
							: 'Create the link first. It will not be public; only people you invite can view it.'}
					</p>
				</div>

				<div
					role="group"
					aria-label="Share access"
					class="grid grid-cols-2 gap-1 rounded-lg border border-white/[0.12] bg-white/[0.035] p-1"
				>
					<button
						type="button"
						aria-pressed={shareMode === 'public'}
						class="flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs transition-colors {shareMode ===
						'public'
							? 'bg-white/[0.1] text-white'
							: 'text-white/45 hover:bg-white/[0.05] hover:text-white/75'}"
						onclick={() => setShareMode('public')}
					>
						<Globe2 class="size-3.5" strokeWidth={1.8} />
						Public
					</button>
					<button
						type="button"
						aria-pressed={shareMode === 'private'}
						class="flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs transition-colors {shareMode ===
						'private'
							? 'bg-white/[0.1] text-white'
							: 'text-white/45 hover:bg-white/[0.05] hover:text-white/75'}"
						onclick={() => setShareMode('private')}
					>
						<LockKeyhole class="size-3.5" strokeWidth={1.8} />
						Private
					</button>
				</div>
			</section>

			{#if ogImageUrl}
				<section
					aria-labelledby="preview-heading"
					class="space-y-3 border-t border-white/[0.09] pt-5"
				>
					<div class="flex items-baseline justify-between gap-3">
						<div>
							<h2 id="preview-heading" class="text-sm font-medium text-white/90">Share preview</h2>
							<p class="mt-1 text-xs leading-5 text-white/42">
								This is how the link will appear when shared.
							</p>
						</div>
						<span class="shrink-0 text-[10px] text-white/30">1200 × 630</span>
					</div>

					<img
						src={ogImageUrl}
						alt={`Open Graph preview for ${previewTitle}`}
						class="aspect-[1200/630] w-full rounded-xl border border-white/[0.12] object-cover"
					/>
				</section>
			{/if}

			<section aria-labelledby="link-heading" class="space-y-3 border-t border-white/[0.09] pt-5">
				<div>
					<h2 id="link-heading" class="text-sm font-medium text-white/90">
						{shareMode === 'public' ? 'Create a public link' : 'Create a private link'}
					</h2>
					<p class="mt-1 text-xs leading-5 text-white/42">
						Leave the custom link empty to generate one automatically.
					</p>
				</div>

				<div class="flex items-center gap-2">
					<div class="relative min-w-0 flex-1">
						<Link2
							class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/35"
							strokeWidth={1.8}
						/>
						<Input
							bind:value={customCode}
							placeholder="Custom link (optional)"
							aria-label="Custom link"
							class="h-10 border-white/[0.12] bg-white/[0.055] pl-9 text-sm text-white placeholder:text-white/28 focus-visible:border-white/30 focus-visible:ring-2 focus-visible:ring-white/10"
						/>
					</div>
					<Button
						class="h-10 shrink-0 bg-[#f1eee9] px-4 text-[13px] font-medium text-[#242322] hover:bg-white disabled:opacity-60"
						disabled={isCreating}
						onclick={handleCreate}
					>
						{#if isCreating}
							<Spinner class="size-4" />
						{:else}
							Create link
						{/if}
					</Button>
				</div>

				{#if isRejectedInput}
					<p class="text-[11px] text-amber-200/80">That custom link is already taken.</p>
				{:else if previewUrl}
					<p class="truncate font-mono text-[11px] text-white/35">{previewUrl}</p>
				{/if}

				{#if lastCreatedUrl}
					<div
						class="flex items-center gap-2 rounded-lg border border-white/[0.1] bg-black/20 px-3 py-2"
					>
						<code class="min-w-0 flex-1 truncate text-xs text-white/65">{lastCreatedUrl}</code>
						<button
							type="button"
							class="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
							onclick={() => copyText(lastCreatedUrl!, 'created')}
						>
							{#if copiedCode === 'created'}
								<Check class="size-3.5 text-emerald-300" strokeWidth={2} />
								Copied
							{:else}
								<Copy class="size-3.5" strokeWidth={1.8} />
								Copy
							{/if}
						</button>
					</div>
				{/if}
			</section>

			{#if shareMode === 'private'}
				<section
					aria-labelledby="email-heading"
					class="space-y-3 border-t border-white/[0.09] pt-5"
				>
					<div>
						<h2 id="email-heading" class="text-sm font-medium text-white/90">Invite by email</h2>
						<p class="mt-1 text-xs leading-5 text-white/42">
							Only invited people can view this link.
						</p>
					</div>

					<div class="flex items-center gap-2">
						<div class="relative min-w-0 flex-1">
							<Mail
								class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/35"
								strokeWidth={1.8}
							/>
							<Input
								bind:value={recipientInput}
								placeholder="name@example.com"
								aria-label="Email address"
								onkeydown={handleRecipientKeydown}
								onblur={addRecipient}
								class="h-10 border-white/[0.12] bg-white/[0.055] pl-9 text-sm text-white placeholder:text-white/28 focus-visible:border-white/30 focus-visible:ring-2 focus-visible:ring-white/10"
							/>
						</div>
						<Button
							variant="outline"
							disabled={!lastCreatedUrl || isCreating}
							class="h-10 shrink-0 border-white/[0.15] bg-transparent px-4 text-[13px] text-white/80 hover:bg-white/[0.08] hover:text-white"
							onclick={handleInvite}
						>
							Send invite
						</Button>
					</div>

					{#if recipients.length > 0}
						<div class="flex flex-wrap gap-1.5">
							{#each recipients as email (email)}
								<span
									class="inline-flex max-w-full items-center gap-1 rounded-md bg-white/[0.08] px-2 py-1 text-[11px] text-white/75"
								>
									<span class="max-w-[180px] truncate">{email}</span>
									<button
										type="button"
										class="text-white/40 transition-colors hover:text-white"
										aria-label={`Remove ${email}`}
										onclick={() => removeRecipient(email)}
									>
										<X class="size-3" strokeWidth={2} />
									</button>
								</span>
							{/each}
						</div>
					{/if}

					<label class="flex cursor-pointer items-center gap-2 text-xs text-white/55">
						<input
							type="checkbox"
							bind:checked={notifyRecipients}
							class="size-3.5 rounded border-white/20 bg-transparent text-[#f1eee9] accent-[#f1eee9] focus:ring-1 focus:ring-white/30"
						/>
						Notify people by email
					</label>

					{#if inviteMessage}
						<p class="text-[11px] text-amber-200/80">{inviteMessage}</p>
					{/if}
				</section>
			{:else}
				<section
					aria-labelledby="social-heading"
					class="space-y-3 border-t border-white/[0.09] pt-5"
				>
					<div>
						<h2 id="social-heading" class="text-sm font-medium text-white/90">Share elsewhere</h2>
						<p class="mt-1 text-xs leading-5 text-white/42">
							Create a link before sharing it publicly.
						</p>
					</div>

					<div class="grid grid-cols-4 gap-2">
						<button
							type="button"
							disabled={!lastCreatedUrl}
							class="group flex h-[62px] flex-col items-center justify-center gap-1.5 rounded-lg border border-white/[0.1] text-white/55 transition-colors hover:border-white/25 hover:bg-white/[0.06] hover:text-white disabled:pointer-events-none disabled:opacity-35"
							onclick={() => openSocialShare('x')}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true" class="size-[18px] fill-current"
								><path
									d="M18.901 1.153h3.68l-8.04 9.19L24 22.847h-7.406l-5.804-7.584-6.64 7.584H.468l8.6-9.83L0 1.154h7.594l5.246 6.932 6.06-6.932Zm-1.291 19.49h2.039L6.486 3.24H4.298L17.61 20.643Z"
								/></svg
							>
							<span class="text-[10px]">X</span>
						</button>
						<button
							type="button"
							disabled={!lastCreatedUrl}
							class="group flex h-[62px] flex-col items-center justify-center gap-1.5 rounded-lg border border-white/[0.1] text-white/55 transition-colors hover:border-white/25 hover:bg-white/[0.06] hover:text-white disabled:pointer-events-none disabled:opacity-35"
							onclick={() => openSocialShare('facebook')}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true" class="size-[18px] fill-current"
								><path
									d="M13.5 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5h1.7V4a22 22 0 0 0-2.5-.1c-2.5 0-4.2 1.5-4.2 4.2V10H7.3v3h2.8v8h3.4Z"
								/></svg
							>
							<span class="text-[10px]">Facebook</span>
						</button>
						<button
							type="button"
							disabled={!lastCreatedUrl}
							class="group flex h-[62px] flex-col items-center justify-center gap-1.5 rounded-lg border border-white/[0.1] text-white/55 transition-colors hover:border-white/25 hover:bg-white/[0.06] hover:text-white disabled:pointer-events-none disabled:opacity-35"
							onclick={() => openSocialShare('reddit')}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true" class="size-[18px] fill-current"
								><path
									d="M14.6 3.4a2.15 2.15 0 1 1 1.8 2.8 7.1 7.1 0 0 1 3.4 2.2 2.12 2.12 0 1 1-1.3 1.2 5.9 5.9 0 0 0-3.4-2.1l-.7 3.6c1.5.2 2.5.8 2.5 1.8 0 1.3-1.5 2.1-3.7 2.1s-3.7-.8-3.7-2.1c0-1 .9-1.6 2.5-1.8l-.7-3.6a5.9 5.9 0 0 0-3.4 2.1 2.1 2.1 0 1 1-1.3-1.2 7.1 7.1 0 0 1 3.4-2.2 2.15 2.15 0 1 1 4.6-2.8Zm-3 9.4c-.8.1-1.4.3-1.4.7s.7.7 2 .7 2-.3 2-.7-.6-.6-1.4-.7l-.6 0-.6 0Zm-.7 4.4c.9.7 2.3.7 3.2 0l.7.9c-1.3 1-3.3 1-4.6 0l.7-.9Z"
								/></svg
							>
							<span class="text-[10px]">Reddit</span>
						</button>
						<button
							type="button"
							disabled={!lastCreatedUrl}
							class="group flex h-[62px] flex-col items-center justify-center gap-1.5 rounded-lg border border-white/[0.1] text-white/55 transition-colors hover:border-white/25 hover:bg-white/[0.06] hover:text-white disabled:pointer-events-none disabled:opacity-35"
							onclick={() => openSocialShare('linkedin')}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true" class="size-[18px] fill-current"
								><path
									d="M5.2 7.1A2.1 2.1 0 1 1 5.2 3a2.1 2.1 0 0 1 0 4.1ZM3.4 21h3.6V8.4H3.4V21Zm5.8-12.6h3.4v1.7h.1c.5-.9 1.7-2.1 3.7-2.1 3.9 0 4.6 2.5 4.6 5.8V21h-3.6v-6.4c0-1.5 0-3.4-2.1-3.4s-2.4 1.6-2.4 3.3V21H9.2V8.4Z"
								/></svg
							>
							<span class="text-[10px]">LinkedIn</span>
						</button>
					</div>
				</section>
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>
