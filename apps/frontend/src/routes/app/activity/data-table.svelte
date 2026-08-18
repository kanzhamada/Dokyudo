<script lang="ts">
	import { type ColumnDef, getCoreRowModel } from '@tanstack/table-core';
	import { createSvelteTable } from '$lib/components/ui/data-table/index.js';
	import { FlexRender } from '$lib/components/ui/data-table/index.js';
	import * as Pagination from '$lib/components/ui/pagination/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { Eye, EyeOff } from 'lucide-svelte';
	import ChevronFirstIcon from '@lucide/svelte/icons/chevron-first';
	import ChevronLastIcon from '@lucide/svelte/icons/chevron-last';
	import { getColumns, type ActivityLog } from './columns.js';

	let {
		data = [],
		meta = {} as { page: number; limit: number; total: number; totalPages: number },
		isLoading = false,
		onPageChange
	}: {
		data: ActivityLog[];
		meta: { page: number; limit: number; total: number; totalPages: number };
		isLoading: boolean;
		onPageChange: (page: number) => void;
	} = $props();

	const columns = getColumns();
	let showAllIps = $state(false);
	let rowIpVisibility = $state<Record<string, boolean>>({});
	let allIpsVisible = $derived.by(() =>
		data.every((activity) => !activity.ipAddress || isIpVisible(activity.id))
	);

	const table = createSvelteTable({
		get data() {
			return data;
		},
		columns: columns as ColumnDef<ActivityLog, unknown>[],
		getCoreRowModel: getCoreRowModel(),
		manualPagination: true,
		get rowCount() {
			return meta.total ?? 0;
		}
	});

	function triggerHaptic(duration = 20) {
		if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
			try {
				navigator.vibrate(duration);
			} catch {
				// Unsupported
			}
		}
	}

	function previousPage() {
		if (meta.page > 1) {
			goToPage(meta.page - 1);
		}
	}

	function nextPage() {
		if (meta.page < meta.totalPages) {
			goToPage(meta.page + 1);
		}
	}

	function goToPage(targetPage: number) {
		if (isLoading || targetPage < 1 || targetPage > meta.totalPages || targetPage === meta.page) {
			return;
		}
		triggerHaptic(15);
		onPageChange(targetPage);
	}

	function isIpVisible(activityId: string): boolean {
		return rowIpVisibility[activityId] ?? showAllIps;
	}

	function toggleAllIps() {
		showAllIps = !allIpsVisible;
		rowIpVisibility = {};
		triggerHaptic(15);
	}

	function toggleIp(activityId: string) {
		rowIpVisibility = {
			...rowIpVisibility,
			[activityId]: !isIpVisible(activityId)
		};
		triggerHaptic(15);
	}
</script>

<Tooltip.Provider>
	<div class="space-y-4">
		<div class="flex justify-end">
			<button
				type="button"
				aria-pressed={allIpsVisible}
				aria-label={allIpsVisible ? 'Hide all IP addresses' : 'Show all IP addresses'}
				title={allIpsVisible ? 'Hide all IP addresses' : 'Show all IP addresses'}
				onclick={toggleAllIps}
				class="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-[#151515] px-2.5 text-xs text-[#969696] transition-colors select-none hover:border-white/20 hover:bg-white/[0.06] hover:text-[#F2F2F2] focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none"
			>
				{#if allIpsVisible}
					<EyeOff class="size-3.5" strokeWidth={1.8} />
					<span>Hide IPs</span>
				{:else}
					<Eye class="size-3.5" strokeWidth={1.8} />
					<span>Show IPs</span>
				{/if}
			</button>
		</div>

		<!-- Table -->
		<div class="overflow-hidden rounded-xl border border-[#302F2F]">
			<Table.Root class="w-full">
				<Table.Header class="[&_tr]:border-[#302F2F]">
					{#each table.getHeaderGroups() as headerGroup}
						<Table.Row class="border-[#302F2F] hover:bg-transparent">
							{#each headerGroup.headers as header}
								<Table.Head
									class="h-11 px-4 text-xs font-medium tracking-wide text-[#767676] uppercase"
								>
									{#if !header.isPlaceholder}
										<FlexRender
											content={header.column.columnDef.header}
											context={header.getContext()}
										/>
									{/if}
								</Table.Head>
							{/each}
						</Table.Row>
					{/each}
				</Table.Header>
				<Table.Body class="[&_tr]:border-[#302F2F]">
					{#if isLoading}
						{#each Array(8) as _}
							<Table.Row class="border-[#302F2F] hover:bg-transparent">
								{#each columns as _col}
									<Table.Cell class="px-4 py-3">
										<Skeleton class="h-4 w-full rounded bg-white/5" />
									</Table.Cell>
								{/each}
							</Table.Row>
						{/each}
					{:else if data.length === 0}
						<Table.Row class="border-[#302F2F] hover:bg-transparent">
							<Table.Cell colspan={columns.length} class="h-32 text-center">
								<div class="flex flex-col items-center gap-2 text-[#767676]">
									<p class="text-sm">No activity recorded yet.</p>
									<p class="text-xs">Actions like logins and document uploads will appear here.</p>
								</div>
							</Table.Cell>
						</Table.Row>
					{:else}
						{#each table.getRowModel().rows as row (row.id)}
							<Table.Row class="border-[#302F2F] transition-colors hover:bg-white/[0.02]">
								{#each row.getVisibleCells() as cell (cell.id)}
									<Table.Cell class="px-4 py-3">
										{@const value = cell.getValue()}
										{#if cell.column.id === 'action'}
											{@const cellData = cell.column.columnDef.cell
												? typeof cell.column.columnDef.cell === 'function'
													? cell.column.columnDef.cell(cell.getContext())
													: cell.column.columnDef.cell
												: null}
											{#if cellData && typeof cellData === 'object' && 'label' in cellData}
												<div class="flex flex-col gap-0.5">
													<div class="flex items-center gap-2">
														<span
															class="inline-block size-1.5 shrink-0 rounded-full {cellData.dotColor}"
														></span>
														<span class="text-sm font-medium text-white">
															{cellData.label}
														</span>
													</div>
													{#if cellData.description}
														<span
															class="ml-[22px] max-w-[240px] truncate text-xs text-[#959595]"
															title={String(cellData.description)}
														>
															{cellData.description}
														</span>
													{/if}
												</div>
											{:else}
												<span class="text-sm text-white">{value}</span>
											{/if}
										{:else if cell.column.id === 'userAgent'}
											{@const cellData = cell.column.columnDef.cell
												? typeof cell.column.columnDef.cell === 'function'
													? cell.column.columnDef.cell(cell.getContext())
													: cell.column.columnDef.cell
												: null}
											{#if cellData && typeof cellData === 'object' && 'display' in cellData}
												<div class="flex min-w-0 flex-col gap-0.5">
													<span class="text-sm text-[#959595]">{cellData.display}</span>
													{#if cellData.details}
														<span class="truncate text-xs text-[#767676]">{cellData.details}</span>
													{/if}
												</div>
											{:else}
												<span class="text-sm text-[#959595]">--</span>
											{/if}
										{:else if cell.column.id === 'ipAddress'}
											{#if value}
												<div class="flex items-center gap-2">
													<span class="text-sm text-[#959595]">
														{isIpVisible(row.original.id) ? value : '••••••••'}
													</span>
													<button
														type="button"
														aria-label={isIpVisible(row.original.id)
															? 'Hide IP address'
															: 'Show IP address'}
														title={isIpVisible(row.original.id)
															? 'Hide IP address'
															: 'Show IP address'}
														onclick={(event) => {
															event.stopPropagation();
															toggleIp(row.original.id);
														}}
														class="inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-[#767676] transition-colors hover:bg-white/[0.06] hover:text-[#F2F2F2] focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none"
													>
														{#if isIpVisible(row.original.id)}
															<EyeOff class="size-3.5" strokeWidth={1.8} />
														{:else}
															<Eye class="size-3.5" strokeWidth={1.8} />
														{/if}
													</button>
												</div>
											{:else}
												<span class="text-sm text-[#959595]">--</span>
											{/if}
										{:else if cell.column.id === 'createdAt'}
											{@const cellData = cell.column.columnDef.cell
												? typeof cell.column.columnDef.cell === 'function'
													? cell.column.columnDef.cell(cell.getContext())
													: cell.column.columnDef.cell
												: null}
											{#if cellData && typeof cellData === 'object' && 'relative' in cellData}
												<Tooltip.Root>
													<Tooltip.Trigger>
														{#snippet child({ props })}
															<span {...props} class="cursor-default text-sm text-[#959595]">
																{cellData.relative}
															</span>
														{/snippet}
													</Tooltip.Trigger>
													<Tooltip.Content
														class="rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-black shadow-md"
													>
														{cellData.full}
													</Tooltip.Content>
												</Tooltip.Root>
											{:else}
												<span class="text-sm text-[#959595]">{value}</span>
											{/if}
										{:else}
											<span class="text-sm text-[#959595]">
												{#if value === null || value === undefined || value === ''}
													--
												{:else}
													{value}
												{/if}
											</span>
										{/if}
									</Table.Cell>
								{/each}
							</Table.Row>
						{/each}
					{/if}
				</Table.Body>
			</Table.Root>
		</div>

		<!-- Pagination -->
		{#if meta.total != null && meta.total > 0}
			<div class="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
				<p class="text-xs text-[#767676]">
					{(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
					{meta.total === 1 ? 'event' : 'events'}
				</p>
				{#if meta.totalPages > 1}
					<div class="flex items-center justify-end">
						<Pagination.Root
							count={meta.total}
							perPage={meta.limit}
							page={meta.page}
							siblingCount={1}
						>
							{#snippet children({ pages, currentPage })}
								<Pagination.Content class="gap-0.5 sm:gap-1">
									<Pagination.Item>
										<button
											type="button"
											aria-label="Go to first page"
											title="First page"
											disabled={isLoading || currentPage === 1}
											onclick={() => goToPage(1)}
											class="flex size-9 cursor-pointer items-center justify-center rounded-full text-white transition-all duration-150 select-none hover:bg-white/10 hover:text-white active:scale-90 disabled:pointer-events-none disabled:text-white/20"
										>
											<ChevronFirstIcon class="size-4" />
										</button>
									</Pagination.Item>

									<Pagination.Item>
										<Pagination.Previous
											onclick={previousPage}
											disabled={isLoading || meta.page <= 1}
											class="cursor-pointer rounded-full text-white transition-all duration-150 select-none hover:bg-white/10 hover:text-white active:scale-90 disabled:text-white/20"
										/>
									</Pagination.Item>

									{#each pages as page (page.key)}
										{#if page.type === 'ellipsis'}
											<Pagination.Item>
												<Pagination.Ellipsis class="text-white/60" />
											</Pagination.Item>
										{:else if (page.value !== 1 && page.value !== meta.totalPages) || page.value === currentPage}
											<Pagination.Item>
												<Pagination.Link
													{page}
													isActive={currentPage === page.value}
													onclick={() => goToPage(page.value)}
													class="cursor-pointer rounded-full text-white/75 transition-all duration-150 select-none hover:bg-white/10 hover:text-white active:scale-90 data-[active=true]:border-white/45 data-[active=true]:bg-white/10 data-[active=true]:text-white"
												>
													{page.value}
												</Pagination.Link>
											</Pagination.Item>
										{/if}
									{/each}

									<Pagination.Item>
										<Pagination.Next
											onclick={nextPage}
											disabled={isLoading || meta.page >= meta.totalPages}
											class="cursor-pointer rounded-full text-white transition-all duration-150 select-none hover:bg-white/10 hover:text-white active:scale-90 disabled:text-white/20"
										/>
									</Pagination.Item>

									<Pagination.Item>
										<button
											type="button"
											aria-label="Go to last page"
											title="Last page"
											disabled={isLoading || currentPage === meta.totalPages}
											onclick={() => goToPage(meta.totalPages)}
											class="flex size-9 cursor-pointer items-center justify-center rounded-full text-white transition-all duration-150 select-none hover:bg-white/10 hover:text-white active:scale-90 disabled:pointer-events-none disabled:text-white/20"
										>
											<ChevronLastIcon class="size-4" />
										</button>
									</Pagination.Item>
								</Pagination.Content>
							{/snippet}
						</Pagination.Root>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</Tooltip.Provider>

<style>
	:global(button),
	:global(a) {
		-webkit-tap-highlight-color: rgba(255, 255, 255, 0.08);
		-webkit-touch-callout: none;
		touch-action: manipulation;
	}
</style>
