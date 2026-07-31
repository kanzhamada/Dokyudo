<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Search, Calendar, RotateCcw } from 'lucide-svelte';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { apiRequest } from '$lib/api/client.js';
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
		selectedCategory = category;
		fetchActivities(1);
	}

	function handleDateChange() {
		fetchActivities(1);
	}

	function resetFilters() {
		searchQuery = '';
		selectedCategory = '';
		startDate = '';
		endDate = '';
		fetchActivities(1);
	}

	const hasActiveFilters = $derived(
		!!searchQuery || !!selectedCategory || !!startDate || !!endDate
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

<div
	class="flex h-full w-full flex-col gap-6 overflow-y-auto px-6 py-6 font-sans md:px-10 md:py-8"
>
	<!-- Breadcrumb -->
	<Breadcrumb.Root class="mt-16 md:mt-0">
		<Breadcrumb.List class="text-sm text-[#767676]">
			<Breadcrumb.Item>
				<Breadcrumb.Link href="/app/dashboard" class="text-[#767676] hover:text-white/70">
					Home
				</Breadcrumb.Link>
			</Breadcrumb.Item>
			<Breadcrumb.Separator class="text-[#767676]" />
			<Breadcrumb.Item>
				<Breadcrumb.Page class="font-medium text-white">Activity Log</Breadcrumb.Page>
			</Breadcrumb.Item>
		</Breadcrumb.List>
	</Breadcrumb.Root>

	<!-- Header -->
	<div>
		<h1 class="text-3xl font-semibold text-white md:text-4xl">Activity Log</h1>
		<p class="mt-1 text-sm font-normal text-[#767676] md:text-base">
			Audit trail of all account events, logins, and document operations.
		</p>
	</div>

	<!-- Controls & Filters Toolbar -->
	<div
		class="flex flex-col gap-4 rounded-xl border border-white/10 bg-[#161616] p-4 md:flex-row md:items-center md:justify-between"
	>
		<!-- Left: Search & Category Buttons -->
		<div class="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
			<!-- Search Bar -->
			<div class="relative flex-1 max-w-xs sm:max-w-sm">
				<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
				<Input
					type="text"
					placeholder="Search action, IP, metadata..."
					class="border-white/10 bg-[#0F0F0F] pl-9 text-sm text-white placeholder:text-white/40 focus:border-white/20"
					bind:value={searchQuery}
					oninput={handleSearchInput}
				/>
			</div>

			<!-- Category Buttons -->
			<div
				class="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/5 bg-[#0F0F0F] p-1"
			>
				{#each [
					{ id: '', label: 'All' },
					{ id: 'auth', label: 'Auth' },
					{ id: 'document', label: 'Documents' },
					{ id: 'billing', label: 'Billing' },
					{ id: 'tenant', label: 'Workspace' }
				] as cat}
					<button
						type="button"
						class="rounded-md px-3 py-1 text-xs font-medium transition-all {selectedCategory === cat.id
							? 'bg-[#262626] text-white shadow-sm'
							: 'text-[#888888] hover:text-white'}"
						onclick={() => handleCategorySelect(cat.id)}
					>
						{cat.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- Right: Date Range & Reset -->
		<div class="flex flex-wrap items-center gap-3">
			<div class="flex items-center gap-2 text-xs text-[#888888]">
				<Calendar class="h-4 w-4 text-white/40" />
				<input
					type="date"
					class="rounded-lg border border-white/10 bg-[#0F0F0F] px-2.5 py-1.5 text-xs text-white focus:border-white/20 focus:outline-none"
					bind:value={startDate}
					onchange={handleDateChange}
				/>
				<span>to</span>
				<input
					type="date"
					class="rounded-lg border border-white/10 bg-[#0F0F0F] px-2.5 py-1.5 text-xs text-white focus:border-white/20 focus:outline-none"
					bind:value={endDate}
					onchange={handleDateChange}
				/>
			</div>

			{#if hasActiveFilters}
				<Button
					variant="ghost"
					size="sm"
					class="h-8 px-2 text-xs text-[#888888] hover:bg-white/5 hover:text-white"
					onclick={resetFilters}
				>
					<RotateCcw class="mr-1 h-3.5 w-3.5" />
					Reset
				</Button>
			{/if}
		</div>
	</div>

	<!-- Data Table -->
	<DataTable
		data={activities}
		{meta}
		{isLoading}
		onPageChange={handlePageChange}
	/>
</div>