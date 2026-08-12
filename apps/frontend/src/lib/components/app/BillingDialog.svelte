<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import {
		Check,
		CreditCard,
		Database,
		ExternalLink,
		FileText,
		HardDrive,
		MessageCircle,
		RefreshCw,
		Search
	} from 'lucide-svelte';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { getMeUsage } from '$lib/api/me';
	import { createBillingPortalSession } from '$lib/api/payments';
	import type { UserUsageResponse } from '$lib/types/auth.types';

	interface Props {
		open?: boolean;
		onClose?: () => void;
	}

	type Tier = UserUsageResponse['tier'];

	interface Plan {
		tier: Tier;
		name: string;
		price: string;
		cadence: string;
		description: string;
		limits: string[];
		features: string[];
	}

	const plans: Plan[] = [
		{
			tier: 'FREE',
			name: 'Free',
			price: 'Rp 0',
			cadence: 'forever',
			description: 'The default tier for every new tenant.',
			limits: [
				'10 MB max file',
				'5 uploads / mo',
				'50 searches / mo',
				'10 Q&A / mo',
				'500 MB storage'
			],
			features: [
				'Hybrid search + RAG included',
				'OAuth via Google and GitHub',
				'Automatic 7-day teardown'
			]
		},
		{
			tier: 'OIL_INVESTOR',
			name: 'Pro Investor',
			price: 'Rp 1,440,000',
			cadence: 'one-time',
			description: 'The portfolio showcase that unlocks the full platform.',
			limits: [
				'25 MB max file',
				'Unlimited* uploads',
				'Unlimited* searches',
				'100 Q&A / mo',
				'40 GB storage'
			],
			features: [
				'One-time sandbox invoice',
				'3 activation vouchers',
				'Unlocks PRO REAL platform-wide'
			]
		},
		{
			tier: 'PRO',
			name: 'Pro Real',
			price: 'Recurring',
			cadence: 'auto-debit',
			description: 'The commercial B2B tier for recurring operations.',
			limits: [
				'25 MB+ max file',
				'Expanded uploads',
				'Expanded searches',
				'100+ Q&A / mo',
				'40 GB+ storage'
			],
			features: [
				'Tokenized recurring billing',
				'Multi-seat license provisioning',
				'Recurring webhook lifecycle'
			]
		},
		{
			tier: 'SIMULATE',
			name: 'Sandbox & Evaluation',
			price: '24h',
			cadence: 'evaluation window',
			description: 'A guided evaluation with no card and no real charges.',
			limits: [
				'25 MB max file',
				'Unlimited* uploads',
				'Unlimited* searches',
				'100 Q&A / mo',
				'2 GB storage'
			],
			features: ['Dummy credentials only', 'Counters reset monthly', 'Self-destruct on expiry']
		}
	];

	let { open = $bindable(false), onClose }: Props = $props();

	let usage = $state<UserUsageResponse | null>(null);
	let isLoading = $state(false);
	let isPortalLoading = $state(false);
	let errorMessage = $state('');

	const activePlan = $derived(plans.find((plan) => plan.tier === usage?.tier) ?? null);

	function formatTier(tier: Tier): string {
		return plans.find((plan) => plan.tier === tier)?.name ?? tier;
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
		const value = bytes / 1024 ** exponent;
		return `${value >= 100 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
	}

	function formatExpiry(expiresAt: string | null): string {
		if (!expiresAt) return 'No expiration';
		return `Access until ${new Date(expiresAt).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		})}`;
	}

	async function loadUsage() {
		if (isLoading) return;
		isLoading = true;
		errorMessage = '';

		try {
			const result = await getMeUsage();
			if (result.ok) {
				usage = result.data;
			} else {
				errorMessage = result.error.message || 'Unable to load usage details.';
			}
		} catch {
			errorMessage = 'Unable to load usage details.';
		} finally {
			isLoading = false;
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

	$effect(() => {
		if (open) {
			untrack(() => void loadUsage());
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
		class="max-h-[min(760px,calc(100vh-2rem))] gap-0 overflow-y-auto rounded-[18px] border border-white/[0.1] bg-[#242322]/[0.85] p-0 text-white shadow-2xl shadow-black/40 backdrop-blur-[42px] sm:max-w-[620px]"
	>
		<Dialog.Header class="border-b border-white/[0.09] px-5 py-4 pr-14">
			<Dialog.Title
				class="flex items-center gap-2 text-[17px] font-medium tracking-[-0.02em] text-white"
			>
				<CreditCard class="size-[15px] text-white/55" strokeWidth={1.8} />
				Billing
			</Dialog.Title>
			<Dialog.Description class="mt-1 text-xs leading-5 text-white/45">
				Review your usage, plan limits, and subscription details.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-5 px-5 py-4">
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
								<h2 class="text-lg font-medium tracking-[-0.02em] text-white">{activePlan.name}</h2>
								<span
									class="inline-flex items-center gap-1 rounded-full border border-white/[0.14] bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-white/60 uppercase"
								>
									<span class="size-1.5 rounded-full bg-white/70"></span>
									Active
								</span>
							</div>
							<p class="mt-1 text-xs text-white/40">{formatExpiry(usage?.expiresAt ?? null)}</p>
						{:else}
							<div class="mt-2 h-5 w-28 animate-pulse rounded bg-white/[0.07]"></div>
						{/if}
					</div>
					<button
						type="button"
						disabled={isLoading}
						class="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white disabled:pointer-events-none disabled:opacity-40"
						onclick={() => loadUsage()}
					>
						<RefreshCw class="size-3 {isLoading ? 'animate-spin' : ''}" strokeWidth={1.8} />
						Refresh
					</button>
				</div>

				{#if isLoading && !usage}
					<div
						class="flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.025] py-10"
					>
						<Spinner class="size-5 text-white/40" />
					</div>
				{:else if errorMessage}
					<div
						class="flex flex-col items-center gap-3 rounded-lg border border-white/[0.1] bg-white/[0.025] px-4 py-8 text-center"
					>
						<p class="text-sm text-white/55">{errorMessage}</p>
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
							</p>
						</div>
						<div class="rounded-lg border border-white/[0.1] bg-white/[0.035] p-3">
							<Search class="mb-2 size-3.5 text-white/40" strokeWidth={1.8} />
							<p class="text-[10px] text-white/35">Searches</p>
							<p class="mt-1 text-base font-medium text-white/85">
								{usage.searchesCount.toLocaleString()}
							</p>
						</div>
						<div class="rounded-lg border border-white/[0.1] bg-white/[0.035] p-3">
							<MessageCircle class="mb-2 size-3.5 text-white/40" strokeWidth={1.8} />
							<p class="text-[10px] text-white/35">Q&amp;A</p>
							<p class="mt-1 text-base font-medium text-white/85">
								{usage.qaCount.toLocaleString()}
							</p>
						</div>
						<div class="rounded-lg border border-white/[0.1] bg-white/[0.035] p-3">
							<HardDrive class="mb-2 size-3.5 text-white/40" strokeWidth={1.8} />
							<p class="text-[10px] text-white/35">Storage</p>
							<p class="mt-1 text-base font-medium text-white/85">
								{formatBytes(usage.storageUsedBytes)}
							</p>
						</div>
					</div>
					<div
						class="mt-3 flex flex-col gap-3 rounded-lg border border-white/[0.1] bg-white/[0.025] p-3 sm:flex-row sm:items-center sm:justify-between"
					>
						<div class="flex items-center gap-2.5">
							<Database class="size-4 text-white/40" strokeWidth={1.8} />
							<div>
								<p class="text-xs text-white/60">Usage tier</p>
								<p class="mt-0.5 text-[11px] text-white/35">
									{formatTier(usage.tier)} · counters reset monthly
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
			</section>

			<section class="border-t border-white/[0.09] pt-5" aria-labelledby="pricing-plans-title">
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
								<p class="mb-1.5 text-[9px] font-medium tracking-wide text-white/30 uppercase">
									Included
								</p>
								{#each plan.features as feature}
									<div class="flex items-start gap-1.5 text-[10px] leading-4 text-white/45">
										<Check class="mt-0.5 size-3 shrink-0 text-white/30" strokeWidth={2} />
										<span>{feature}</span>
									</div>
								{/each}
							</div>
						</article>
					{/each}
				</div>
				<p class="mt-3 text-[10px] leading-4 text-white/30">
					*Unlimited values are subject to fair-use backend caps. Storage is cumulative and does not
					reset monthly.
				</p>
			</section>
		</div>
	</Dialog.Content>
</Dialog.Root>
