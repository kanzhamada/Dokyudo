<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { toast } from 'svelte-sonner';
	import { Calendar, RotateCcw } from 'lucide-svelte';
	import MxIcon from '$lib/components/icons/MxIcon.svelte';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { apiRequest } from '$lib/api/client.js';
	import { seo } from '$lib/seo';
	import DataTable from './data-table.svelte';
	import type { ActivityLog } from './columns.js';

	let activities = $state<ActivityLog[]>([]);
	let meta = $state<{ page: number; limit: number; total: number; totalPages: number }>({
		page: 1,
		limit: 15,
		total: 0,
		totalPages: 1
	});
	let isLoading = $state(true);

	let searchQuery = $state('');
	let selectedCategory = $state('');
	let startDate = $state('');
	let endDate = $state('');

	let searchTimeout: ReturnType<typeof setTimeout>;

	function triggerHaptic(duration = 20) {
		if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
			try {
				navigator.vibrate(duration);
			} catch {
				// Unsupported
			}
		}
	}

	async function fetchActivities(queryPage: number = 1) {
		isLoading = true;

		const params = new URLSearchParams();
		params.set('page', String(queryPage));
		params.set('limit', String(meta.limit));

		if (selectedCategory) params.set('category', selectedCategory);
		if (startDate) params.set('startDate', new Date(startDate).toISOString());
		if (endDate) {
			const end = new Date(endDate);
			end.setHours(23, 59, 59, 999);
			params.set('endDate', end.toISOString());
		}
		if (searchQuery.trim()) params.set('search', searchQuery.trim());

		console.log('[Activity Log] Outbound Payload:', Object.fromEntries(params));

		const result = await apiRequest<{
			data: ActivityLog[];
			meta: { page: number; limit: number; total: number; totalPages: number };
		}>(`/api/activities?${params.toString()}`);

		console.log('[Activity Log] Backend Response:', result);

		if (result.ok) {
			activities = result.data.data;
			meta = result.data.meta;
		} else {
			console.error('[Activity Log] Fetch Error:', result.error);
			toast.error('Error', { description: result.error.message || 'Failed to load activity log.' });
		}

		isLoading = false;
	}

	function handlePageChange(newPage: number) {
		fetchActivities(newPage);
	}

	function handleSearchInput() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			fetchActivities(1);
		}, 300);
	}

	function handleCategorySelect(category: string) {
		triggerHaptic(15);
		selectedCategory = category;
		fetchActivities(1);
	}

	function handleDateChange() {
		fetchActivities(1);
	}

	function resetFilters() {
		triggerHaptic(15);
		searchQuery = '';
		selectedCategory = '';
		startDate = '';
		endDate = '';
		fetchActivities(1);
	}

	const hasActiveFilters = $derived(
		!!searchQuery || !!selectedCategory || !!startDate || !!endDate
	);
	const activeFilterCount = $derived(
		[searchQuery, selectedCategory, startDate, endDate].filter(Boolean).length
	);

	onMount(() => {
		const urlParams = $page.url.searchParams;
		searchQuery = urlParams.get('search') || '';
		selectedCategory = urlParams.get('category') || '';
		startDate = urlParams.get('startDate') || '';
		endDate = urlParams.get('endDate') || '';
		const initialPage = parseInt(urlParams.get('page') || '1');

		fetchActivities(initialPage);
	});
</script>

<svelte:head>
	{@html seo({ title: 'Activity Log | Dokyudo', description: 'Activity log for your Dokyudo workspace.', noindex: true })}
</svelte:head>

<div class="flex h-full w-full flex-col gap-6 overflow-y-auto px-6 py-6 font-sans md:px-10 md:py-8">
	<!-- Breadcrumb -->
	<Breadcrumb.Root class="mt-16 md:mt-0">
		<Breadcrumb.List class="text-sm text-warm-gray">
			<Breadcrumb.Item>
				<Breadcrumb.Link href="/app/dashboard" class="text-warm-gray hover:text-white/70">
					Home
				</Breadcrumb.Link>
			</Breadcrumb.Item>
			<Breadcrumb.Separator class="text-warm-gray" />
			<Breadcrumb.Item>
				<Breadcrumb.Page class="font-medium text-white">Activity Log</Breadcrumb.Page>
			</Breadcrumb.Item>
		</Breadcrumb.List>
	</Breadcrumb.Root>

	<!-- Header -->
	<div>
		<h1 class="text-3xl font-semibold text-white md:text-4xl">Activity Log</h1>
		<p class="mt-1 text-sm font-normal text-warm-gray md:text-base">
			Audit trail of all account events, logins, and document operations.
		</p>
	</div>

	<!-- Controls & Filters Toolbar -->
	<div
		class="grid gap-2.5 rounded-xl border border-white/10 bg-offblack/90 p-2.5 shadow-[0_12px_30px_rgba(0,0,0,0.12)] lg:grid-cols-[minmax(220px,1fr)_auto] xl:grid-cols-[minmax(220px,0.8fr)_auto_auto]"
	>
		<!-- Search -->
		<div class="relative min-w-0">
			<label for="activity-search" class="sr-only">Search activity</label>
			<MxIcon
				name="receipt-search-outline"
				class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/55"
			/>
			<Input
				id="activity-search"
				type="text"
				placeholder="Search activity, IP, or metadata"
				class="h-9 border-white/10 bg-black/40 pl-9 text-[13px] text-white placeholder:text-warm-gray/60 focus-visible:border-white/30 focus-visible:ring-2 focus-visible:ring-white/10"
				bind:value={searchQuery}
				oninput={handleSearchInput}
			/>
		</div>

		<!-- Category Segmented Control -->
		<div
			class="flex min-w-0 [scrollbar-width:none] items-center gap-0.5 overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-1 [&::-webkit-scrollbar]:hidden"
			role="group"
			aria-label="Filter by category"
		>
			{#each [{ id: '', label: 'All' }, { id: 'auth', label: 'Auth' }, { id: 'document', label: 'Documents' }, { id: 'billing', label: 'Billing' }, { id: 'tenant', label: 'Workspace' }] as cat}
				<button
					type="button"
					aria-pressed={selectedCategory === cat.id}
					class="h-7 shrink-0 cursor-pointer select-none rounded-md px-2.5 text-[11px] font-medium transition-all duration-150 active:scale-[0.96] {selectedCategory ===
					cat.id
						? 'bg-offwhite text-black shadow-[0_2px_8px_rgba(255,255,255,0.12)]'
						: 'text-warm-gray hover:bg-white/[0.06] hover:text-white'}"
					onclick={() => handleCategorySelect(cat.id)}
				>
					{cat.label}
				</button>
			{/each}
		</div>

		<!-- Date Range & Reset -->
		<div class="flex min-w-0 items-center gap-2 lg:col-span-2 lg:justify-self-end xl:col-span-1">
			<div class="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] text-warm-gray sm:flex-none">
				<Calendar class="hidden size-4 shrink-0 text-white/55 sm:block" strokeWidth={1.8} />
				<label for="activity-start-date" class="sr-only">Start date</label>
				<input
					id="activity-start-date"
					type="date"
					aria-label="Start date"
					class="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-2.5 text-[11px] text-white transition-colors outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 sm:w-[132px] sm:flex-none"
					style="color-scheme: dark"
					bind:value={startDate}
					onchange={handleDateChange}
				/>
				<span class="shrink-0 text-gray">to</span>
				<label for="activity-end-date" class="sr-only">End date</label>
				<input
					id="activity-end-date"
					type="date"
					aria-label="End date"
					class="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-2.5 text-[11px] text-white transition-colors outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 sm:w-[132px] sm:flex-none"
					style="color-scheme: dark"
					bind:value={endDate}
					onchange={handleDateChange}
				/>
			</div>

			<Button
				variant="ghost"
				size="sm"
				class="h-9 shrink-0 cursor-pointer select-none gap-1.5 rounded-lg px-2.5 text-[11px] text-warm-gray transition-all duration-150 hover:bg-white/[0.06] hover:text-white active:scale-[0.94] disabled:opacity-40"
				onclick={resetFilters}
				disabled={!hasActiveFilters}
				aria-label="Reset filters"
			>
				<RotateCcw class="size-3.5" strokeWidth={1.8} />
				<span>Reset</span>
				{#if hasActiveFilters}
					<span
						class="flex size-4 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-offwhite"
					>
						{activeFilterCount}
					</span>
				{/if}
			</Button>
		</div>
	</div>

	<!-- Data Table -->
	<DataTable data={activities} {meta} {isLoading} onPageChange={handlePageChange} />
</div>

<style>
	:global(button),
	:global(a) {
		-webkit-tap-highlight-color: rgba(255, 255, 255, 0.08);
		-webkit-touch-callout: none;
		touch-action: manipulation;
	}
</style>
