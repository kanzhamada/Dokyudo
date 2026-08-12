<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Spinner } from '$lib/components/ui/spinner';
	import {
		CalendarClock,
		Check,
		Copy,
		CreditCard,
		ExternalLink,
		Eye,
		EyeOff,
		FileText,
		HardDrive,
		KeyRound,
		Link2,
		LockKeyhole,
		MessageCircle,
		RefreshCw,
		RotateCw,
		Search,
		Settings2,
		UserRound
	} from 'lucide-svelte';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { authUpdatePassword, authUpdateTenantName } from '$lib/api/auth';
	import {
		getMeCached,
		getMeUsageCached,
		invalidateMeCache
	} from '$lib/state/me-cache.store.svelte';
	import { deleteKey, getKeys, upsertKey } from '$lib/api/keys';
	import { createBillingPortalSession, createCheckoutSession } from '$lib/api/payments';
	import { deleteAllShares, deleteAllTenantShares, deleteShare, listAllShares } from '$lib/api/rag';
	import {
		TIER_LIMITS,
		TIER_PLANS,
		type TierPlan,
		type TierType
	} from '$lib/constants/tiers.constant';
	import { profilePasswordSchema, tenantNameSchema } from '$lib/schemas/auth.schema';
	import {
		accountPanel,
		closeAccountPanel,
		markByokSaved,
		type AccountPanelTab
	} from '$lib/state/account-panel.store.svelte';
	import { sessionStore } from '$lib/state/session.store.svelte';
	import type { UserProfileResponse, UserUsageResponse } from '$lib/types/auth.types';
	import type { ShareListItem } from '$lib/types/rag.types';
	import MxIcon from '$lib/components/icons/MxIcon.svelte';

	import geminiIcon from '$lib/assets/llm/gemini.svg';
	import mistralIcon from '$lib/assets/llm/mistral.svg';
	import openrouterIcon from '$lib/assets/llm/openrouter.svg';

	interface Props {
		onClose?: () => void;
		onNameUpdated?: (name: string) => void;
	}

	type ByokProvider = 'gemini' | 'mistral' | 'openrouter';

	interface ByokProviderOption {
		id: ByokProvider;
		label: string;
		description: string;
		icon: string;
		placeholder: string;
	}

	const BYOK_PROVIDER_OPTIONS: ByokProviderOption[] = [
		{
			id: 'gemini',
			label: 'Google AI',
			description: 'Gemini models',
			icon: geminiIcon,
			placeholder: 'AIza...'
		},
		{
			id: 'mistral',
			label: 'Mistral',
			description: 'Mistral models',
			icon: mistralIcon,
			placeholder: 'Mistral API key'
		},
		{
			id: 'openrouter',
			label: 'OpenRouter',
			description: 'Access more models',
			icon: openrouterIcon,
			placeholder: 'sk-or-v1-...'
		}
	];

	type Plan = TierPlan & { tier: TierType; limits: string[] };

	const planOrder: TierType[] = ['FREE', 'OIL_INVESTOR', 'PRO', 'SIMULATE'];
	const PAGE_SIZE = 10;

	const tabs: { id: AccountPanelTab; label: string; description: string }[] = [
		{
			id: 'settings',
			label: 'Settings',
			description: 'Manage your workspace identity and account password.'
		},
		{
			id: 'billing',
			label: 'Billing',
			description: 'Review your usage, plan limits, and subscription details.'
		},
		{
			id: 'shared-links',
			label: 'Shared links',
			description: 'Manage the active links you have created.'
		},
		{
			id: 'byok',
			label: 'Configure BYOK',
			description: 'Connect your own API key to access provider models directly.'
		}
	];

	let { onClose, onNameUpdated }: Props = $props();

	const activeTab = $derived(tabs.find((t) => t.id === accountPanel.tab) ?? tabs[0]);

	// ─── Settings panel state ────────────────────────────────────────────────
	let profile = $state<UserProfileResponse | null>(null);
	let displayName = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let profileLoading = $state(false);
	let savingName = $state(false);
	let updatingPassword = $state(false);
	let profileError = $state('');
	let nameError = $state('');
	let passwordError = $state('');
	let confirmPasswordError = $state('');
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);

	// ─── Billing panel state ─────────────────────────────────────────────────
	let usage = $state<UserUsageResponse | null>(null);
	let billingLoading = $state(false);
	let isPortalLoading = $state(false);
	let isCheckoutLoading = $state(false);
	let billingError = $state('');
	let currentTime = $state(new Date());
	let clockTimer: number | null = null;

	// ─── Shared links panel state ────────────────────────────────────────────
	const origin = typeof window !== 'undefined' ? window.location.origin : '';
	let shares = $state<ShareListItem[]>([]);
	let sharesLoading = $state(false);
	let isDeletingAll = $state(false);
	let deletingConversationId = $state<string | null>(null);
	let sharesError = $state('');
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

	interface ShareGroup {
		conversationId: string;
		title: string;
		shares: ShareListItem[];
		updatedAt: string;
	}

	const groups = $derived.by(() => {
		const byConversation: Record<string, ShareGroup> = {};
		for (const share of filteredShares) {
			const existing = byConversation[share.conversationId];
			if (existing) {
				existing.shares.push(share);
				if (share.createdAt > existing.updatedAt) existing.updatedAt = share.createdAt;
			} else {
				byConversation[share.conversationId] = {
					conversationId: share.conversationId,
					title: share.title,
					shares: [share],
					updatedAt: share.createdAt
				};
			}
		}
		return Object.values(byConversation).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
	});

	const totalPages = $derived(Math.max(1, Math.ceil(groups.length / PAGE_SIZE)));
	const pageGroups = $derived(groups.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE));

	// ─── Billing helpers ─────────────────────────────────────────────────────
	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
		const value = bytes / 1024 ** exponent;
		return `${value >= 100 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
	}

	function formatPlanLimits(tier: TierType): string[] {
		const limits = TIER_LIMITS[tier];
		return [
			`${formatBytes(limits.maxFileSizeBytes)} max file`,
			`${limits.maxUploadsPerMonth.toLocaleString()} uploads / mo`,
			`${limits.maxSearchesPerMonth.toLocaleString()} searches / mo`,
			`${limits.maxQnaPerMonth.toLocaleString()} Q&A / mo`,
			`${formatBytes(limits.maxStorageBytes)} storage`
		];
	}

	const plans: Plan[] = planOrder.map((tier) => ({
		tier,
		...TIER_PLANS[tier],
		limits: formatPlanLimits(tier)
	}));

	const activePlan = $derived(plans.find((plan) => plan.tier === usage?.tier) ?? null);
	const activeLimits = $derived(usage ? TIER_LIMITS[usage.tier] : null);

	const resetCountdown = $derived.by(() => {
		if (usage?.tier !== 'FREE') return '';
		const nextReset = new Date(
			Date.UTC(currentTime.getUTCFullYear(), currentTime.getUTCMonth() + 1, 1)
		);
		const totalMinutes = Math.max(
			0,
			Math.ceil((nextReset.getTime() - currentTime.getTime()) / 60000)
		);
		const days = Math.floor(totalMinutes / (24 * 60));
		const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
		const minutes = totalMinutes % 60;
		return `${days}d ${hours}h ${minutes}m`;
	});

	function formatExpiry(expiresAt: string | null): string {
		if (!expiresAt) return 'No expiration';
		return `Access until ${new Date(expiresAt).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		})}`;
	}

	async function loadUsage() {
		if (billingLoading) return;
		billingLoading = true;
		billingError = '';

		try {
			const result = await getMeUsageCached();
			if (result.ok) {
				usage = result.data;
			} else {
				billingError = result.error.message || 'Unable to load usage details.';
			}
		} catch {
			billingError = 'Unable to load usage details.';
		} finally {
			billingLoading = false;
		}
	}

	async function openBillingPortal() {
		if (isPortalLoading) return;
		isPortalLoading = true;

		try {
			const result = await createBillingPortalSession();
			if (result.ok) {
				window.location.assign(result.data.portalUrl);
			} else {
				toast.error(result.error.message || 'Unable to open Stripe billing portal.');
			}
		} catch {
			toast.error('Unable to open Stripe billing portal.');
		} finally {
			isPortalLoading = false;
		}
	}

	async function openSandboxCheckout() {
		if (isCheckoutLoading) return;
		isCheckoutLoading = true;

		try {
			const result = await createCheckoutSession({ tierToUnlock: 'SIMULATE' });
			if (result.ok) {
				window.location.assign(result.data.checkoutUrl);
			} else {
				toast.error(result.error.message || 'Unable to open Sandbox checkout.');
			}
		} catch {
			toast.error('Unable to open Sandbox checkout.');
		} finally {
			isCheckoutLoading = false;
		}
	}

	// ─── Settings helpers ────────────────────────────────────────────────────
	async function loadProfile() {
		if (profileLoading) return;
		profileLoading = true;
		profileError = '';

		try {
			const result = await getMeCached();
			if (result.ok) {
				profile = result.data;
				displayName = result.data.tenant.name;
			} else {
				profileError = result.error.message || 'Unable to load profile details.';
			}
		} catch {
			profileError = 'Unable to load profile details.';
		} finally {
			profileLoading = false;
		}
	}

	function resetPasswordForm() {
		password = '';
		confirmPassword = '';
		passwordError = '';
		confirmPasswordError = '';
		showPassword = false;
		showConfirmPassword = false;
	}

	async function handleNameSubmit(event: SubmitEvent) {
		event.preventDefault();
		nameError = '';

		const parsed = tenantNameSchema.safeParse(displayName);
		if (!parsed.success) {
			nameError = parsed.error.issues[0]?.message || 'Enter a valid display name.';
			return;
		}
		if (savingName) return;

		savingName = true;
		try {
			const result = await authUpdateTenantName({ name: parsed.data });
			if (result.ok) {
				displayName = result.data.tenant.name;
				if (profile) {
					profile = { ...profile, tenant: { ...profile.tenant, name: result.data.tenant.name } };
				}
				onNameUpdated?.(result.data.tenant.name);
				invalidateMeCache();
				toast.success(result.data.message || 'Display name updated');
			} else {
				nameError = result.error.message || 'Unable to update display name.';
			}
		} catch {
			nameError = 'Unable to update display name.';
		} finally {
			savingName = false;
		}
	}

	async function handlePasswordSubmit(event: SubmitEvent) {
		event.preventDefault();
		passwordError = '';
		confirmPasswordError = '';

		const parsed = profilePasswordSchema.safeParse({ password, confirmPassword });
		if (!parsed.success) {
			for (const issue of parsed.error.issues) {
				if (issue.path[0] === 'confirmPassword') {
					confirmPasswordError = issue.message;
				} else if (!passwordError) {
					passwordError = issue.message;
				}
			}
			return;
		}
		if (updatingPassword) return;

		updatingPassword = true;
		try {
			const result = await authUpdatePassword({ newPassword: parsed.data.password });
			if (result.ok) {
				toast.success(result.data.message || 'Password updated. Please sign in again.');
				resetPasswordForm();
				accountPanel.open = false;
				sessionStore.clear();
				await goto('/login');
			} else {
				passwordError = result.error.message || 'Unable to update password.';
			}
		} catch {
			passwordError = 'Unable to update password.';
		} finally {
			updatingPassword = false;
		}
	}

	// ─── Shared links helpers ────────────────────────────────────────────────
	function setSearchQuery(value: string) {
		searchQuery = value;
		currentPage = 1;
	}

	function shareUrl(code: string, accessToken?: string | null): string {
		return accessToken
			? `${origin}/s/${code}?invite=${encodeURIComponent(accessToken)}`
			: `${origin}/s/${code}`;
	}

	function openLink(share: ShareListItem) {
		window.open(shareUrl(share.code, share.accessToken), '_blank', 'noopener,noreferrer');
	}

	function formatShareDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatShareExpiry(expiresAt: string | null): string {
		return expiresAt ? `Expires ${formatShareDate(expiresAt)}` : 'No expiry';
	}

	async function loadShares() {
		if (sharesLoading) return;
		sharesLoading = true;
		sharesError = '';
		try {
			const result = await listAllShares();
			if (result.ok) {
				shares = result.data.shares;
			} else {
				sharesError = 'Unable to load shared links.';
			}
		} catch {
			sharesError = 'Unable to load shared links.';
		} finally {
			sharesLoading = false;
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

	async function revokeConversation(conversationId: string) {
		if (deletingConversationId) return;
		deletingConversationId = conversationId;
		try {
			const result = await deleteAllShares(conversationId);
			if (result.ok) {
				shares = shares.filter((share) => share.conversationId !== conversationId);
				toast.success('Conversation shares revoked');
			} else {
				toast.error(result.error.message);
			}
		} catch {
			toast.error('Unable to revoke conversation shares');
		} finally {
			deletingConversationId = null;
		}
	}

	async function copyLink(share: ShareListItem) {
		try {
			await navigator.clipboard.writeText(shareUrl(share.code, share.accessToken));
			copiedCode = share.code;
			setTimeout(() => {
				if (copiedCode === share.code) copiedCode = null;
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

	// ─── BYOK panel state ────────────────────────────────────────────────────
	let provider = $state<ByokProvider>('gemini');
	let apiKey = $state('');
	let isSavingKey = $state(false);
	let isResettingKey = $state(false);
	let byokError = $state('');
	let keyMasks = $state<Record<ByokProvider, string>>({
		gemini: '',
		mistral: '',
		openrouter: ''
	});

	const providerLabel = $derived(
		BYOK_PROVIDER_OPTIONS.find((item) => item.id === provider)?.label ?? ''
	);

	async function loadKeyMasks() {
		try {
			const keysRes = await getKeys();
			if (!keysRes.ok) return;
			const nextMasks: Record<ByokProvider, string> = {
				gemini: '',
				mistral: '',
				openrouter: ''
			};
			for (const item of keysRes.data.data ?? []) {
				const p = item.provider.toLowerCase();
				if (p === 'gemini' || p === 'mistral' || p === 'openrouter') {
					nextMasks[p] = item.maskedKey;
				}
			}
			keyMasks = nextMasks;
		} catch (err) {
			console.error('[AccountPanel] Failed to fetch BYOK keys:', err);
		}
	}

	function selectConfigureProvider(next: ByokProvider) {
		provider = next;
		apiKey = '';
		byokError = '';
	}

	async function saveConfigureKey() {
		const key = apiKey.trim();
		if (!key || isSavingKey) return;

		isSavingKey = true;
		byokError = '';
		try {
			const result = await upsertKey(provider, key);
			if (!result.ok) {
				byokError = result.error.message;
				return;
			}

			await loadKeyMasks();
			markByokSaved();
			apiKey = '';
			accountPanel.open = false;
			toast.success(`${providerLabel} key saved`);
		} catch (err) {
			console.error('[AccountPanel] Failed to save BYOK key:', err);
			byokError = 'Failed to save API key.';
		} finally {
			isSavingKey = false;
		}
	}

	async function resetConfigureKey() {
		if (isResettingKey) return;

		isResettingKey = true;
		byokError = '';
		try {
			const result = await deleteKey(provider);
			if (!result.ok) {
				byokError = result.error.message;
				return;
			}

			await loadKeyMasks();
			markByokSaved();
			toast.success(`${providerLabel} key reset`);
		} catch (err) {
			console.error('[AccountPanel] Failed to reset BYOK key:', err);
			byokError = 'Failed to reset API key.';
		} finally {
			isResettingKey = false;
		}
	}

	// ─── Loading + clock effects ─────────────────────────────────────────────
	// Setiap tab hanya me-load endpoint SATU KALI per sesi dialog terbuka.
	// Flag loadedTabs di-reset saat dialog ditutup, jadi membuka ulang panel
	// akan me-refresh data tanpa menembak endpoint berulang saat pindah tab.
	let loadedTabs = $state({
		settings: false,
		billing: false,
		'shared-links': false,
		byok: false
	});

	$effect(() => {
		if (accountPanel.open && accountPanel.tab === 'settings' && !loadedTabs.settings) {
			loadedTabs.settings = true;
			untrack(() => void loadProfile());
		}
	});

	$effect(() => {
		if (accountPanel.open && accountPanel.tab === 'billing' && !loadedTabs.billing) {
			loadedTabs.billing = true;
			untrack(() => void loadUsage());
		}
	});

	$effect(() => {
		if (accountPanel.open && accountPanel.tab === 'shared-links' && !loadedTabs['shared-links']) {
			loadedTabs['shared-links'] = true;
			untrack(() => void loadShares());
		}
	});

	$effect(() => {
		if (accountPanel.open && accountPanel.tab === 'byok' && !loadedTabs.byok) {
			loadedTabs.byok = true;
			untrack(() => void loadKeyMasks());
		}
	});

	$effect(() => {
		if (!accountPanel.open) {
			loadedTabs = { settings: false, billing: false, 'shared-links': false, byok: false };
		}
	});

	$effect(() => {
		if (accountPanel.open && accountPanel.tab === 'billing') {
			currentTime = new Date();
			clockTimer = window.setInterval(() => {
				currentTime = new Date();
			}, 1000);
			return () => {
				if (clockTimer !== null) window.clearInterval(clockTimer);
				clockTimer = null;
			};
		}
	});
</script>

<Dialog.Root
	bind:open={accountPanel.open}
	onOpenChange={(nextOpen) => {
		if (!nextOpen) {
			closeAccountPanel();
			onClose?.();
		}
	}}
>
	<Dialog.Content
		showCloseButton={true}
		class="max-h-[min(780px,calc(100vh-2rem))] gap-0 overflow-hidden rounded-[18px] border border-white/[0.1] bg-[#242322]/[0.85] p-0 text-white shadow-2xl shadow-black/40 backdrop-blur-[42px] sm:max-w-[880px] lg:max-w-[940px]"
	>
		<Dialog.Header class="border-b border-white/[0.09] px-5 py-4 pr-14">
			<Dialog.Title
				class="flex items-center gap-2 text-[17px] font-medium tracking-[-0.02em] text-white"
			>
				{#if accountPanel.tab === 'settings'}
					<Settings2 class="size-[15px] text-white/55" strokeWidth={1.8} />
				{:else if accountPanel.tab === 'billing'}
					<CreditCard class="size-[15px] text-white/55" strokeWidth={1.8} />
				{:else if accountPanel.tab === 'byok'}
					<KeyRound class="size-[15px] text-white/55" strokeWidth={1.8} />
				{:else}
					<Link2 class="size-[15px] text-white/55" strokeWidth={1.8} />
				{/if}
				{activeTab.label}
			</Dialog.Title>
			<Dialog.Description class="mt-1 text-xs leading-5 text-white/45">
				{activeTab.description}
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex h-[70vh] min-h-0 flex-col sm:h-[600px] sm:flex-row">
			<!-- Side tab rail -->
			<nav
				aria-label="Account sections"
				class="flex shrink-0 [scrollbar-width:none] flex-row gap-0.5 overflow-x-auto border-b border-white/[0.09] p-2 sm:w-52 sm:flex-col sm:border-r sm:border-b-0 sm:py-3 [&::-webkit-scrollbar]:hidden"
			>
				{#each tabs as item (item.id)}
					<button
						type="button"
						aria-current={accountPanel.tab === item.id ? 'page' : undefined}
						class="flex shrink-0 cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors {accountPanel.tab ===
						item.id
							? 'bg-white/[0.08] text-white'
							: 'text-white/50 hover:bg-white/[0.04] hover:text-white/80'}"
						onclick={() => (accountPanel.tab = item.id)}
					>
						{#if item.id === 'settings'}
							<Settings2 class="size-4 shrink-0" strokeWidth={1.8} />
						{:else if item.id === 'billing'}
							<CreditCard class="size-4 shrink-0" strokeWidth={1.8} />
						{:else if item.id === 'byok'}
							<KeyRound class="size-4 shrink-0" strokeWidth={1.8} />
						{:else}
							<Link2 class="size-4 shrink-0" strokeWidth={1.8} />
						{/if}
						<span class="whitespace-nowrap">{item.label}</span>
					</button>
				{/each}
			</nav>

			<!-- Panel content -->
			<div class="min-h-0 flex-1 overflow-y-auto">
				{#if accountPanel.tab === 'settings'}
					<div class="space-y-5 p-5">
						<section aria-labelledby="profile-details-title">
							<div class="mb-3 flex items-start gap-2.5">
								<div
									class="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/[0.07]"
								>
									<UserRound class="size-3.5 text-white/45" strokeWidth={1.8} />
								</div>
								<div class="min-w-0 flex-1">
									<h2 id="profile-details-title" class="text-sm font-medium text-white/80">
										Display name
									</h2>
									<p class="mt-0.5 text-[11px] leading-4 text-white/35">
										This name is shown across your Dokyudo workspace.
									</p>
								</div>
								{#if profileLoading}
									<Spinner class="mt-1 size-3.5 text-white/40" />
								{/if}
							</div>

							<form class="space-y-2.5" onsubmit={handleNameSubmit}>
								<label for="profile-display-name" class="text-[11px] font-medium text-white/55">
									Workspace name
								</label>
								<Input
									id="profile-display-name"
									name="name"
									type="text"
									bind:value={displayName}
									disabled={profileLoading || savingName}
									autocomplete="organization"
									placeholder="Enter a display name"
									aria-invalid={!!nameError}
									class="h-10 rounded-lg border-white/[0.12] bg-white/[0.055] text-sm text-white placeholder:text-white/28 focus-visible:border-white/30 focus-visible:ring-2 focus-visible:ring-white/10"
								/>
								{#if nameError}
									<p class="text-xs text-red-300" role="alert">{nameError}</p>
								{:else if profileError}
									<p class="text-xs text-red-300" role="alert">{profileError}</p>
								{/if}
								<div class="flex justify-end pt-0.5">
									<Button
										type="submit"
										disabled={profileLoading || savingName || !profile}
										class="h-9 rounded-lg bg-[#DB8F5E] px-3 text-xs font-medium text-black hover:bg-[#E59C6D] disabled:opacity-40"
									>
										{#if savingName}
											<Spinner class="mr-1.5 size-3.5" />
											Saving...
										{:else}
											Save name
										{/if}
									</Button>
								</div>
							</form>
						</section>

						<section class="border-t border-white/[0.09] pt-5" aria-labelledby="password-title">
							<div class="mb-3 flex items-start gap-2.5">
								<div
									class="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/[0.07]"
								>
									<KeyRound class="size-3.5 text-white/45" strokeWidth={1.8} />
								</div>
								<div>
									<h2 id="password-title" class="text-sm font-medium text-white/80">
										Change password
									</h2>
									<p class="mt-0.5 text-[11px] leading-4 text-white/35">
										Use at least 8 characters with upper, lower, number, and symbol.
									</p>
								</div>
							</div>

							<form class="space-y-2.5" onsubmit={handlePasswordSubmit}>
								<div class="space-y-1.5">
									<label for="profile-password" class="text-[11px] font-medium text-white/55">
										New password
									</label>
									<div class="relative">
										<Input
											id="profile-password"
											name="password"
											type={showPassword ? 'text' : 'password'}
											bind:value={password}
											disabled={updatingPassword}
											autocomplete="new-password"
											aria-invalid={!!passwordError}
											class="h-10 rounded-lg border-white/[0.12] bg-white/[0.055] pr-10 text-sm text-white placeholder:text-white/28 focus-visible:border-white/30 focus-visible:ring-2 focus-visible:ring-white/10"
										/>
										<button
											type="button"
											class="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-white/35 transition-colors hover:text-white"
											aria-label={showPassword ? 'Hide new password' : 'Show new password'}
											aria-pressed={showPassword}
											onclick={() => (showPassword = !showPassword)}
										>
											{#if showPassword}
												<EyeOff class="size-4" strokeWidth={1.8} />
											{:else}
												<Eye class="size-4" strokeWidth={1.8} />
											{/if}
										</button>
									</div>
									{#if passwordError}
										<p class="text-xs text-red-300" role="alert">{passwordError}</p>
									{/if}
								</div>

								<div class="space-y-1.5">
									<label
										for="profile-confirm-password"
										class="text-[11px] font-medium text-white/55"
									>
										Confirm password
									</label>
									<div class="relative">
										<Input
											id="profile-confirm-password"
											name="confirmPassword"
											type={showConfirmPassword ? 'text' : 'password'}
											bind:value={confirmPassword}
											disabled={updatingPassword}
											autocomplete="new-password"
											aria-invalid={!!confirmPasswordError}
											class="h-10 rounded-lg border-white/[0.12] bg-white/[0.055] pr-10 text-sm text-white placeholder:text-white/28 focus-visible:border-white/30 focus-visible:ring-2 focus-visible:ring-white/10"
										/>
										<button
											type="button"
											class="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-white/35 transition-colors hover:text-white"
											aria-label={showConfirmPassword
												? 'Hide password confirmation'
												: 'Show password confirmation'}
											aria-pressed={showConfirmPassword}
											onclick={() => (showConfirmPassword = !showConfirmPassword)}
										>
											{#if showConfirmPassword}
												<EyeOff class="size-4" strokeWidth={1.8} />
											{:else}
												<Eye class="size-4" strokeWidth={1.8} />
											{/if}
										</button>
									</div>
									{#if confirmPasswordError}
										<p class="text-xs text-red-300" role="alert">{confirmPasswordError}</p>
									{/if}
								</div>

								<div class="flex justify-end pt-0.5">
									<Button
										type="submit"
										disabled={updatingPassword}
										class="h-9 rounded-lg bg-[#DB8F5E] px-3 text-xs font-medium text-black hover:bg-[#E59C6D] disabled:opacity-40"
									>
										{#if updatingPassword}
											<Spinner class="mr-1.5 size-3.5" />
											Updating...
										{:else}
											Update password
										{/if}
									</Button>
								</div>
							</form>
						</section>
					</div>
				{:else if accountPanel.tab === 'billing'}
					<div class="space-y-5 p-5">
						<section aria-labelledby="current-plan-title">
							<div class="mb-3 flex items-start justify-between gap-3">
								<div class="min-w-0">
									<p
										id="current-plan-title"
										class="text-[11px] font-medium tracking-wide text-white/45 uppercase"
									>
										Current plan
									</p>
									{#if activePlan}
										<div class="mt-1 flex flex-wrap items-center gap-2">
											<h2 class="text-lg font-medium tracking-[-0.02em] text-white">
												{activePlan.name}
											</h2>
											<span
												class="inline-flex items-center gap-1 rounded-full border border-white/[0.14] bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-white/60 uppercase"
											>
												<span class="size-1.5 rounded-full bg-white/70"></span>
												Active
											</span>
										</div>
										<p class="mt-1 text-xs text-white/40">
											{usage?.tier === 'FREE'
												? 'Monthly access'
												: formatExpiry(usage?.expiresAt ?? null)}
										</p>
									{:else}
										<div class="mt-2 h-5 w-28 animate-pulse rounded bg-white/[0.07]"></div>
									{/if}
								</div>
								<button
									type="button"
									disabled={billingLoading}
									class="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white disabled:pointer-events-none disabled:opacity-40"
									onclick={() => loadUsage()}
								>
									<RefreshCw
										class="size-3 {billingLoading ? 'animate-spin' : ''}"
										strokeWidth={1.8}
									/>
									Refresh
								</button>
							</div>

							{#if billingLoading && !usage}
								<div
									class="flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.025] py-10"
								>
									<Spinner class="size-5 text-white/40" />
								</div>
							{:else if billingError}
								<div
									class="flex flex-col items-center gap-3 rounded-lg border border-white/[0.1] bg-white/[0.025] px-4 py-8 text-center"
								>
									<p class="text-sm text-white/55">{billingError}</p>
									<Button
										variant="outline"
										class="border-white/[0.15] bg-transparent text-xs text-white/75 hover:bg-white/[0.08] hover:text-white"
										onclick={() => loadUsage()}
									>
										Try again
									</Button>
								</div>
							{:else if usage}
								<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
									<div class="rounded-lg border border-white/[0.1] bg-white/[0.035] p-3">
										<FileText class="mb-2 size-3.5 text-white/40" strokeWidth={1.8} />
										<p class="text-[10px] text-white/35">Uploads</p>
										<p class="mt-1 text-base font-medium text-white/85">
											{usage.uploadsCount.toLocaleString()}
											<span class="text-[10px] font-normal text-white/35">
												/ {activeLimits?.maxUploadsPerMonth}</span
											>
										</p>
									</div>
									<div class="rounded-lg border border-white/[0.1] bg-white/[0.035] p-3">
										<Search class="mb-2 size-3.5 text-white/40" strokeWidth={1.8} />
										<p class="text-[10px] text-white/35">Searches</p>
										<p class="mt-1 text-base font-medium text-white/85">
											{usage.searchesCount.toLocaleString()}
											<span class="text-[10px] font-normal text-white/35">
												/ {activeLimits?.maxSearchesPerMonth}</span
											>
										</p>
									</div>
									<div class="rounded-lg border border-white/[0.1] bg-white/[0.035] p-3">
										<MessageCircle class="mb-2 size-3.5 text-white/40" strokeWidth={1.8} />
										<p class="text-[10px] text-white/35">Q&amp;A</p>
										<p class="mt-1 text-base font-medium text-white/85">
											{usage.qaCount.toLocaleString()}
											<span class="text-[10px] font-normal text-white/35">
												/ {activeLimits?.maxQnaPerMonth}</span
											>
										</p>
									</div>
									<div class="rounded-lg border border-white/[0.1] bg-white/[0.035] p-3">
										<HardDrive class="mb-2 size-3.5 text-white/40" strokeWidth={1.8} />
										<p class="text-[10px] text-white/35">Storage</p>
										<p class="mt-1 text-base font-medium text-white/85">
											{formatBytes(usage.storageUsedBytes)}
											<span class="text-[10px] font-normal text-white/35">
												/ {formatBytes(activeLimits?.maxStorageBytes ?? 0)}</span
											>
										</p>
									</div>
								</div>
								{#if usage.tier === 'FREE'}
									<div
										class="mt-3 flex items-center gap-2.5 rounded-lg border border-white/[0.1] bg-white/[0.025] p-3"
									>
										<CalendarClock class="size-4 shrink-0 text-white/40" strokeWidth={1.8} />
										<div>
											<p class="text-xs text-white/60">Monthly reset</p>
											<p class="mt-0.5 text-[11px] text-white/35">
												Resets in {resetCountdown} · 1st at 00:00 UTC
											</p>
										</div>
									</div>
								{:else}
									<div
										class="mt-3 flex flex-col gap-3 rounded-lg border border-white/[0.1] bg-white/[0.025] p-3 sm:flex-row sm:items-center sm:justify-between"
									>
										<div class="flex items-center gap-2.5">
											<CalendarClock class="size-4 shrink-0 text-white/40" strokeWidth={1.8} />
											<div>
												<p class="text-xs text-white/60">Subscription</p>
												<p class="mt-0.5 text-[11px] text-white/35">
													{formatExpiry(usage.expiresAt)}
												</p>
											</div>
										</div>
										<Button
											variant="outline"
											disabled={isPortalLoading}
											onclick={openBillingPortal}
											class="h-9 shrink-0 border-white/[0.15] bg-white/[0.04] text-xs text-white/75 hover:bg-white/[0.1] hover:text-white disabled:opacity-40"
										>
											{#if isPortalLoading}
												<Spinner class="mr-1.5 size-3.5" />
												Opening...
											{:else}
												<ExternalLink class="mr-1.5 size-3.5" strokeWidth={1.8} />
												Manage billing
											{/if}
										</Button>
									</div>
								{/if}
							{/if}
						</section>

						<section
							class="border-t border-white/[0.09] pt-5"
							aria-labelledby="pricing-plans-title"
						>
							<div class="mb-3 flex items-end justify-between gap-3">
								<div>
									<h2 id="pricing-plans-title" class="text-sm font-medium text-white/80">
										Pricing plans
									</h2>
									<p class="mt-0.5 text-[11px] text-white/35">
										Compare the limits and features included with each tier.
									</p>
								</div>
							</div>

							<div class="grid gap-2.5 sm:grid-cols-2">
								{#each plans as plan (plan.tier)}
									<article
										class="rounded-lg border p-3 transition-colors {usage?.tier === plan.tier
											? 'border-white/[0.3] bg-white/[0.07]'
											: 'border-white/[0.1] bg-white/[0.025]'}"
										aria-label={`${plan.name} pricing plan`}
									>
										<div class="flex items-start justify-between gap-2">
											<div class="min-w-0">
												<h3 class="truncate text-sm font-medium text-white/80">{plan.name}</h3>
												<p class="mt-0.5 text-[10px] leading-4 text-white/35">{plan.description}</p>
											</div>
											{#if usage?.tier === plan.tier}
												<span
													class="shrink-0 rounded-full border border-white/[0.14] bg-white/[0.08] px-1.5 py-0.5 text-[9px] font-medium text-white/65"
												>
													Current
												</span>
											{/if}
										</div>
										<div class="mt-3 flex items-baseline gap-1.5">
											<span class="text-base font-medium tracking-[-0.02em] text-white/85"
												>{plan.price}</span
											>
											<span class="text-[10px] text-white/35">/ {plan.cadence}</span>
										</div>
										<div class="mt-3 space-y-1.5 border-t border-white/[0.08] pt-3">
											{#each plan.limits as limit}
												<div class="flex items-start gap-1.5 text-[10px] text-white/55">
													<Check class="mt-0.5 size-3 shrink-0 text-white/40" strokeWidth={2} />
													<span>{limit}</span>
												</div>
											{/each}
										</div>
										<div class="mt-3 border-t border-white/[0.08] pt-3">
											<p
												class="mb-1.5 text-[9px] font-medium tracking-wide text-white/30 uppercase"
											>
												Included
											</p>
											{#each plan.features as feature}
												<div class="flex items-start gap-1.5 text-[10px] leading-4 text-white/45">
													<Check class="mt-0.5 size-3 shrink-0 text-white/30" strokeWidth={2} />
													<span>{feature}</span>
												</div>
											{/each}
										</div>

										{#if plan.tier === 'SIMULATE'}
											<button
												type="button"
												disabled={isCheckoutLoading || usage?.tier === 'SIMULATE'}
												onclick={openSandboxCheckout}
												class="mt-3 inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-white px-3 text-xs font-medium text-[#1B1B1B] transition-colors hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-40"
											>
												{#if isCheckoutLoading}
													<Spinner class="size-3.5" />
													Opening checkout...
												{:else if usage?.tier === 'SIMULATE'}
													Sandbox active
												{:else}
													Access Sandbox
												{/if}
											</button>
										{:else if plan.locked}
											<button
												type="button"
												disabled
												class="relative mt-3 inline-flex h-9 w-full cursor-not-allowed items-center justify-center overflow-hidden rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 text-xs font-medium text-white/30"
											>
												Unavailable
												<span
													class="absolute inset-0 flex items-center justify-center bg-[#242322]/70"
												>
													<LockKeyhole class="size-3.5 text-white/55" strokeWidth={1.8} />
												</span>
											</button>
										{:else}
											<button
												type="button"
												disabled
												class="mt-3 inline-flex h-9 w-full cursor-not-allowed items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 text-xs font-medium text-white/35"
											>
												{usage?.tier === plan.tier ? 'Current plan' : 'Included'}
											</button>
										{/if}
									</article>
								{/each}
							</div>
							<p class="mt-3 text-[10px] leading-4 text-white/30">
								*Unlimited values are subject to fair-use backend caps. Storage is cumulative and
								does not reset monthly.
							</p>
						</section>
					</div>
				{:else if accountPanel.tab === 'byok'}
					<div class="p-5">
						<div class="flex gap-2">
							{#each BYOK_PROVIDER_OPTIONS as providerOption (providerOption.id)}
								<button
									type="button"
									class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors {provider ===
									providerOption.id
										? 'border-[#DB8F5E]/60 bg-[#DB8F5E]/10 text-white'
										: 'border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.08] hover:text-white/80'}"
									onclick={() => selectConfigureProvider(providerOption.id)}
								>
									<img
										src={providerOption.icon}
										alt={providerOption.label}
										class="size-4 shrink-0 opacity-70 brightness-0 invert"
									/>
									<span class="min-w-0 truncate text-xs font-medium">{providerOption.label}</span>
								</button>
							{/each}
						</div>

						<div class="mt-5 flex flex-col gap-3">
							<div class="flex items-center justify-between gap-3">
								<div>
									<p class="text-sm font-medium text-white/85">{providerLabel} API key</p>
									<p class="mt-1 text-xs text-white/40">
										{BYOK_PROVIDER_OPTIONS.find((item) => item.id === provider)?.description}
									</p>
								</div>
								<KeyRound class="size-4 text-white/35" />
							</div>

							{#if keyMasks[provider]}
								<div
									class="flex h-10 items-center justify-between rounded-lg border border-white/15 bg-black/20 px-3"
								>
									<div class="flex items-center gap-2 text-sm text-white/75">
										<Check class="size-4 text-white/60" />
										<span>API Key Configured</span>
									</div>
									<button
										type="button"
										class="flex cursor-pointer items-center gap-1 text-xs text-white/50 transition-colors hover:text-white/85 disabled:cursor-not-allowed disabled:opacity-50"
										disabled={isResettingKey}
										onclick={resetConfigureKey}
									>
										<RotateCw class="size-3.5" />
										<span>{isResettingKey ? 'Resetting...' : 'Reset Key'}</span>
									</button>
								</div>
							{:else}
								<Input
									type="password"
									bind:value={apiKey}
									placeholder={BYOK_PROVIDER_OPTIONS.find((item) => item.id === provider)
										?.placeholder}
									class="h-10 border-white/15 bg-black/20 text-sm text-white placeholder:text-white/25 focus-visible:border-[#DB8F5E]/60 focus-visible:ring-[#DB8F5E]/20"
									autocomplete="new-password"
								/>
							{/if}

							{#if byokError}
								<p class="text-xs text-red-400">{byokError}</p>
							{/if}

							<div class="flex justify-end pt-0.5">
								<Button
									class="h-9 cursor-pointer rounded-lg bg-[#DB8F5E] px-3 text-xs font-medium text-black hover:bg-[#E59C6D] disabled:opacity-50"
									disabled={!apiKey.trim() || isSavingKey || isResettingKey}
									onclick={saveConfigureKey}
								>
									{#if isSavingKey}
										<Spinner class="mr-1.5 size-3.5" />
										Saving...
									{:else}
										Save key
									{/if}
								</Button>
							</div>
						</div>
					</div>
				{:else}
					<div class="p-5">
						<div class="mb-3 flex items-center justify-between gap-3">
							<p class="text-xs font-medium text-white/55">
								{shares.length} active {shares.length === 1 ? 'link' : 'links'}
							</p>
							<div class="flex items-center gap-1">
								<button
									type="button"
									class="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white disabled:pointer-events-none disabled:opacity-40"
									disabled={sharesLoading}
									onclick={() => loadShares()}
								>
									<RefreshCw
										class="size-3 {sharesLoading ? 'animate-spin' : ''}"
										strokeWidth={1.8}
									/>
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
											<MxIcon name="trash-bin-minimalistic-outline" class="size-3" />
										{/if}
										Delete all
									</button>
								{/if}
							</div>
						</div>

						{#if shares.length > 0}
							<div class="relative mb-3">
								<MxIcon
									name="receipt-search-outline"
									class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/35"
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

						{#if sharesLoading && shares.length === 0}
							<div class="flex items-center justify-center py-16">
								<Spinner class="size-5 text-white/40" />
							</div>
						{:else if sharesError}
							<div class="flex flex-col items-center gap-3 py-12 text-center">
								<p class="text-sm text-white/55">{sharesError}</p>
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
								<MxIcon name="receipt-search-outline" class="size-6 text-white/20" />
								<p class="text-sm text-white/60">No shared links match your search</p>
								<p class="max-w-xs text-xs leading-5 text-white/35">
									Try a different title or link code.
								</p>
							</div>
						{:else}
							<div class="space-y-4">
								{#each pageGroups as group (group.conversationId)}
									<div class="overflow-hidden rounded-lg border border-white/[0.1]">
										<div
											class="flex items-center gap-2.5 border-b border-white/[0.08] bg-white/[0.035] px-3 py-2"
										>
											<div
												class="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/[0.07]"
											>
												<MxIcon name="document-outline" class="size-3.5 text-white/45" />
											</div>
											<p class="min-w-0 flex-1 truncate text-xs font-medium text-white/75">
												{group.title}
											</p>
											<span class="shrink-0 text-[10px] text-white/35">
												{group.shares.length}
												{group.shares.length === 1 ? 'link' : 'links'}
											</span>
											<button
												type="button"
												class="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-white/45 transition-colors hover:bg-red-500/[0.1] hover:text-red-300 disabled:pointer-events-none disabled:opacity-40"
												aria-label={`Delete all links for ${group.title}`}
												disabled={deletingConversationId !== null}
												onclick={() => revokeConversation(group.conversationId)}
											>
												{#if deletingConversationId === group.conversationId}
													<RefreshCw class="size-3 animate-spin" strokeWidth={1.8} />
												{:else}
													<MxIcon name="trash-bin-minimalistic-outline" class="size-3" />
												{/if}
												Delete
											</button>
										</div>
										<div class="divide-y divide-white/[0.07]">
											{#each group.shares as share (share.code)}
												<div class="flex items-center gap-3 py-2.5 pr-2.5 pl-3">
													<div
														class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]"
													>
														<Link2 class="size-3.5 text-white/45" strokeWidth={1.8} />
													</div>
													<div class="min-w-0 flex-1">
														<div class="flex items-center gap-2">
															<p class="truncate text-sm text-white/80">{share.title}</p>
															{#if share.isPrivate}
																<span
																	class="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/[0.12] bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-white/55 uppercase"
																>
																	<LockKeyhole class="size-2.5" strokeWidth={1.8} />
																	Private
																</span>
															{/if}
														</div>
														<p class="mt-0.5 truncate font-mono text-[10px] text-white/35">
															{shareUrl(share.code)}
														</p>
														<p class="mt-1 text-[10px] text-white/35">
															Created {formatShareDate(share.createdAt)} ·{' '}
															{formatShareExpiry(share.expiresAt)}
														</p>
													</div>
													<div class="flex shrink-0 items-center gap-0.5">
														<button
															type="button"
															aria-label={`Open ${share.title}`}
															class="flex size-8 cursor-pointer items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white"
															onclick={() => openLink(share)}
														>
															<ExternalLink class="size-3.5" strokeWidth={1.8} />
														</button>
														<button
															type="button"
															class="flex size-8 cursor-pointer items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white"
															aria-label={`Copy ${share.title}`}
															onclick={() => copyLink(share)}
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
															<MxIcon name="trash-bin-minimalistic-outline" class="size-3.5" />
														</button>
													</div>
												</div>
											{/each}
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
				{/if}
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
