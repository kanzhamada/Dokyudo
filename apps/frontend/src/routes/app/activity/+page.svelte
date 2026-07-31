<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
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

	async function fetchActivities(queryPage: number = 1) {
		isLoading = true;

		console.log('[Activity Log] Fetching activities:', {
			page: queryPage,
			limit: meta.limit
		});

		const result = await apiRequest<{
			data: ActivityLog[];
			meta: { page: number; limit: number; total: number; totalPages: number };
		}>(`/api/activities?page=${queryPage}&limit=${meta.limit}`);

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
		const params = new URLSearchParams($page.url.searchParams);
		params.set('page', String(newPage));
		goto(`?${params.toString()}`, { replaceState: true, noScroll: true });
		fetchActivities(newPage);
	}

	onMount(() => {
		const initialPage = parseInt($page.url.searchParams.get('page') || '1');
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

	<!-- Data Table -->
	<DataTable
		data={activities}
		{meta}
		{isLoading}
		onPageChange={handlePageChange}
	/>
</div>