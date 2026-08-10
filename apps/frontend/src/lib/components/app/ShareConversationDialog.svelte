<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import { Input } from '$lib/components/ui/input';
	import {
		Check,
		Copy,
		Globe2,
		Link2,
		LockKeyhole,
		Mail,
		UserRound,
		X
	} from 'lucide-svelte';
	import MxIcon from '$lib/components/icons/MxIcon.svelte';
	import { toast } from 'svelte-sonner';
	import { addShareInvitees, createShare } from '$lib/api/rag';
	import { getMe } from '$lib/api/me';

	interface Props {
		open?: boolean;
		conversationId: string;
		conversationTitle?: string;
		onClose?: () => void;
	}

	let {
		open = $bindable(false),
		conversationId,
		conversationTitle = 'Untitled conversation',
		onClose
	}: Props = $props();

	const EXPIRY_OPTIONS: { label: string; hours: number | null }[] = [
		{ label: '1 hour', hours: 1 },
		{ label: '1 day', hours: 24 },
		{ label: '1 month', hours: 720 },
		{ label: 'No expiry', hours: null }
	];

	type SocialNetwork = 'x' | 'facebook' | 'reddit' | 'linkedin';
	type ShareMode = 'public' | 'private';

	let selectedExpiry = $state<number | null>(null);
	let shareMode = $state<ShareMode>('public');
	let customCode = $state('');
	let isCreating = $state(false);
	let errorMessage = $state('');
	let copiedCode = $state<string | null>(null);
	let lastCreatedUrl = $state<string | null>(null);
	let lastCreatedCode = $state<string | null>(null);
	let lastAccessToken = $state<string | null>(null);
	let isInviting = $state(false);
	let recipientInput = $state('');
	let recipients = $state<string[]>([]);
	let currentUserEmail = $state<string | null>(null);
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
		lastCreatedCode
			? `${origin}/s/${lastCreatedCode}/opengraph-image.svg${lastAccessToken ? `?invite=${lastAccessToken}` : ''}`
			: null
	);
	const previewTitle = $derived(conversationTitle?.trim() || 'Untitled conversation');
	const normalizedUserEmail = $derived(currentUserEmail?.trim().toLowerCase() ?? '');

	function shareUrlOf(code: string, accessToken?: string | null): string {
		return accessToken
			? `${origin}/s/${code}?invite=${encodeURIComponent(accessToken)}`
			: `${origin}/s/${code}`;
	}

	function resetDialogState() {
		customCode = '';
		shareMode = 'public';
		lastCreatedUrl = null;
		lastCreatedCode = null;
		lastAccessToken = null;
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
		lastCreatedCode = null;
		lastAccessToken = null;
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
				...(code ? { customCode: code } : {}),
				...(shareMode === 'private' && recipients.length > 0
					? { emails: recipients, notify: notifyRecipients }
					: {})
			});

			if (result.ok) {
				lastAccessToken = result.data.accessToken ?? null;
				lastCreatedUrl = shareUrlOf(result.data.code, lastAccessToken);
				lastCreatedCode = result.data.code;
				customCode = '';
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

	function normalizeEmail(email: string): string {
		return email.trim().toLowerCase();
	}

	function addRecipient(): boolean {
		const email = normalizeEmail(recipientInput);
		if (!email) return false;
		if (!isValidEmail(email)) {
			inviteMessage = 'Enter a valid email address.';
			return false;
		}
		if (recipients.includes(email)) {
			inviteMessage = `${email} is already invited.`;
			return false;
		}
		if (normalizedUserEmail && email === normalizedUserEmail) {
			inviteMessage = 'You cannot invite your own email address.';
			return false;
		}
		recipients.push(email);
		recipientInput = '';
		inviteMessage = '';
		return true;
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

	async function handleInvite() {
		if (recipientInput.trim()) addRecipient();
		if (!hasValidRecipients) {
			inviteMessage = 'Add at least one email address.';
			return;
		}
		inviteMessage = '';
		isInviting = true;
		try {
			// No link yet? Generate one with a random code (current expiry),
			// then invite — the backend handles both in a single call.
			if (!lastCreatedCode) {
				const result = await createShare(conversationId, {
					...(selectedExpiry !== null ? { expiresInHours: selectedExpiry } : {}),
					emails: recipients,
					notify: notifyRecipients
				});
				if (result.ok) {
					lastAccessToken = result.data.accessToken ?? null;
					lastCreatedCode = result.data.code;
					lastCreatedUrl = shareUrlOf(result.data.code, lastAccessToken);
					recipients = [];
					recipientInput = '';
					toast.success(
						notifyRecipients
							? 'Share link created and invite emails sent'
							: 'Share link created and invite added'
					);
				} else {
					inviteMessage = result.error.message;
				}
				return;
			}

			const result = await addShareInvitees(lastCreatedCode, {
				emails: recipients,
				notify: notifyRecipients
			});
			if (result.ok) {
				// A freshly created link may have been public — the backend
				// promotes it to private and returns the access token.
				lastAccessToken = result.data.accessToken ?? lastAccessToken;
				lastCreatedUrl = shareUrlOf(lastCreatedCode, lastAccessToken);
				recipients = [];
				recipientInput = '';
				toast.success(
					notifyRecipients
						? 'Invite emails sent'
						: `${result.data.added.length} ${result.data.added.length === 1 ? 'person' : 'people'} invited`
				);
			} else {
				inviteMessage = result.error.message;
			}
		} catch {
			inviteMessage = 'Unable to send invitations. Try again.';
		} finally {
			isInviting = false;
		}
	}

	function socialShareUrl(network: SocialNetwork): string | null {
		if (!lastCreatedUrl) return null;
		const encodedUrl = encodeURIComponent(lastCreatedUrl);
		if (network === 'x') return `https://twitter.com/intent/tweet?url=${encodedUrl}`;
		if (network === 'facebook') return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
		if (network === 'reddit') return `https://www.reddit.com/submit?url=${encodedUrl}`;
		return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
	}

	async function loadCurrentUserEmail() {
		const result = await getMe();
		if (result.ok) {
			currentUserEmail = result.data.user.email ?? null;
		}
	}

	$effect(() => {
		if (open) {
			resetDialogState();
			void loadCurrentUserEmail();
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
		class="max-h-[min(720px,calc(100vh-2rem))] gap-0 overflow-y-auto rounded-[18px] border border-white/[0.1] bg-[#242322]/[0.85] p-0 text-white shadow-2xl shadow-black/40 backdrop-blur-[42px] sm:max-w-[520px]"
	>
		<Dialog.Header class="border-b border-white/[0.09] px-5 py-4 pr-14">
			<Dialog.Title
				class="flex items-center gap-2 text-[17px] font-medium tracking-[-0.02em] text-white"
			>
				<MxIcon name="share-outline" class="size-[15px] text-white/55" />
				Share conversation
			</Dialog.Title>
			<Dialog.Description class="mt-1 text-xs leading-5 text-white/45">
				Create a link, invite specific people, or share it publicly.
			</Dialog.Description>
		</Dialog.Header>

		<div class="min-w-0 space-y-5 px-5 py-5">
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
							: 'Create the link first, then invite people. Only invited emails can view it.'}
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
						class="flex min-w-0 items-center gap-2 overflow-hidden rounded-lg border border-white/[0.1] bg-black/20 px-3 py-2"
					>
						<code
							class="block min-w-0 flex-1 truncate font-mono text-xs text-white/65"
							title={lastCreatedUrl}>{lastCreatedUrl}</code
						>
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
						<div class="flex items-baseline justify-between gap-3">
							<h2 id="email-heading" class="text-sm font-medium text-white/90">Invite by email</h2>
							{#if recipients.length > 0}
								<span class="text-[10px] text-white/40">
									{recipients.length} invited
								</span>
							{/if}
						</div>
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
								class="h-10 border-white/[0.12] bg-white/[0.055] pl-9 text-sm text-white placeholder:text-white/28 focus-visible:border-white/30 focus-visible:ring-2 focus-visible:ring-white/10"
							/>
						</div>
						<Button
							variant="outline"
							disabled={!recipientInput.trim()}
							class="h-10 shrink-0 cursor-pointer border-white/[0.15] bg-transparent px-4 text-[13px] text-white/80 hover:bg-white/[0.08] hover:text-white"
							onclick={addRecipient}
						>
							Add
						</Button>
						<Button
							variant="outline"
							disabled={isCreating || isInviting || !hasValidRecipients}
							class="h-10 shrink-0 cursor-pointer border-white/[0.15] bg-transparent px-4 text-[13px] text-white/80 hover:bg-white/[0.08] hover:text-white"
							onclick={handleInvite}
						>
							{#if isInviting}
								<Spinner class="size-4" />
							{:else}
								Send invite
							{/if}
						</Button>
					</div>

					{#if recipients.length > 0}
						<div
							class="divide-y divide-white/[0.09] rounded-lg border border-white/[0.12] bg-white/[0.035]"
						>
							{#each recipients as email (email)}
								<div class="flex items-center gap-2.5 px-3 py-2">
									<div
										class="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/[0.08]"
									>
										<UserRound class="size-3.5 text-white/45" strokeWidth={1.8} />
									</div>
									<span class="min-w-0 flex-1 truncate text-xs text-white/75">{email}</span>
									<button
										type="button"
										class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/[0.1] hover:text-white"
										aria-label={`Remove ${email}`}
										onclick={() => removeRecipient(email)}
									>
										<X class="size-3" strokeWidth={2} />
									</button>
								</div>
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
						<a
							href={socialShareUrl('x')}
							target="_blank"
							rel="noopener noreferrer"
							aria-disabled={!lastCreatedUrl}
							tabindex={lastCreatedUrl ? 0 : -1}
							class="group flex h-[62px] flex-col items-center justify-center gap-1.5 rounded-lg border border-white/[0.1] text-white/55 transition-colors hover:border-white/25 hover:bg-white/[0.06] hover:text-white {lastCreatedUrl
								? ''
								: 'pointer-events-none opacity-35'}"
						>
							<svg viewBox="0 0 24 24" aria-hidden="true" class="size-[18px] fill-current"
								><path
									d="M18.901 1.153h3.68l-8.04 9.19L24 22.847h-7.406l-5.804-7.584-6.64 7.584H.468l8.6-9.83L0 1.154h7.594l5.246 6.932 6.06-6.932Zm-1.291 19.49h2.039L6.486 3.24H4.298L17.61 20.643Z"
								/></svg
							>
							<span class="text-[10px]">X</span>
						</a>
						<a
							href={socialShareUrl('facebook')}
							target="_blank"
							rel="noopener noreferrer"
							aria-disabled={!lastCreatedUrl}
							tabindex={lastCreatedUrl ? 0 : -1}
							class="group flex h-[62px] flex-col items-center justify-center gap-1.5 rounded-lg border border-white/[0.1] text-white/55 transition-colors hover:border-white/25 hover:bg-white/[0.06] hover:text-white {lastCreatedUrl
								? ''
								: 'pointer-events-none opacity-35'}"
						>
							<svg viewBox="0 0 24 24" aria-hidden="true" class="size-[18px] fill-current"
								><path
									d="M13.5 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5h1.7V4a22 22 0 0 0-2.5-.1c-2.5 0-4.2 1.5-4.2 4.2V10H7.3v3h2.8v8h3.4Z"
								/></svg
							>
							<span class="text-[10px]">Facebook</span>
						</a>
						<a
							href={socialShareUrl('reddit')}
							target="_blank"
							rel="noopener noreferrer"
							aria-disabled={!lastCreatedUrl}
							tabindex={lastCreatedUrl ? 0 : -1}
							class="group flex h-[62px] flex-col items-center justify-center gap-1.5 rounded-lg border border-white/[0.1] text-white/55 transition-colors hover:border-white/25 hover:bg-white/[0.06] hover:text-white {lastCreatedUrl
								? ''
								: 'pointer-events-none opacity-35'}"
						>
							<svg viewBox="0 0 256 256" aria-hidden="true" class="size-[18px] fill-current"
								><path
									d="M248,104a31.99228,31.99228,0,0,0-52.9375-24.19043c-16.75439-8.90112-36.76172-14.279-57.666-15.52539l5.19581-31.17578,21.83105,3.3584a24.00409,24.00409,0,1,0,2.43506-15.814l-29.64209-4.56006a7.996,7.996,0,0,0-9.10742,6.5918l-6.91309,41.478c-21.83887.94165-42.813,6.37891-60.2583,15.647a31.99266,31.99266,0,0,0-42.59229,47.74024A59.04669,59.04669,0,0,0,16,144c0,21.93457,12.042,42.35156,33.90723,57.48926C70.875,216.00588,98.60938,224,128,224s57.125-7.99414,78.09277-22.51074C227.958,186.35158,240,165.93459,240,144a59.01726,59.01726,0,0,0-2.3457-16.44922A32.17163,32.17163,0,0,0,248,104ZM72,132a16,16,0,1,1,16,16A16.01833,16.01833,0,0,1,72,132Zm92.69629,51.10938a80.122,80.122,0,0,1-73.39209,0,8,8,0,0,1,7.34033-14.2168,64.09433,64.09433,0,0,0,58.71094,0,8.00008,8.00008,0,0,1,7.34082,14.2168ZM168,148a16,16,0,1,1,16-16A16.01833,16.01833,0,0,1,168,148Z"
								/></svg
							>
							<span class="text-[10px]">Reddit</span>
						</a>
						<a
							href={socialShareUrl('linkedin')}
							target="_blank"
							rel="noopener noreferrer"
							aria-disabled={!lastCreatedUrl}
							tabindex={lastCreatedUrl ? 0 : -1}
							class="group flex h-[62px] flex-col items-center justify-center gap-1.5 rounded-lg border border-white/[0.1] text-white/55 transition-colors hover:border-white/25 hover:bg-white/[0.06] hover:text-white {lastCreatedUrl
								? ''
								: 'pointer-events-none opacity-35'}"
						>
							<svg viewBox="0 0 24 24" aria-hidden="true" class="size-[18px] fill-current"
								><path
									d="M5.2 7.1A2.1 2.1 0 1 1 5.2 3a2.1 2.1 0 0 1 0 4.1ZM3.4 21h3.6V8.4H3.4V21Zm5.8-12.6h3.4v1.7h.1c.5-.9 1.7-2.1 3.7-2.1 3.9 0 4.6 2.5 4.6 5.8V21h-3.6v-6.4c0-1.5 0-3.4-2.1-3.4s-2.4 1.6-2.4 3.3V21H9.2V8.4Z"
								/></svg
							>
							<span class="text-[10px]">LinkedIn</span>
						</a>
					</div>
				</section>
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>
