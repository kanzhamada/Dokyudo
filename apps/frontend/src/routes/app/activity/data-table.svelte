<script lang="ts">
	import {
		type ColumnDef,
		getCoreRowModel
	} from '@tanstack/table-core';
	import { createSvelteTable } from '$lib/components/ui/data-table/index.js';
	import { FlexRender } from '$lib/components/ui/data-table/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
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

	function previousPage() {
		if (meta.page > 1) {
			onPageChange(meta.page - 1);
		}
	}

	function nextPage() {
		if (meta.page < meta.totalPages) {
			onPageChange(meta.page + 1);
		}
	}
</script>

<Tooltip.Provider>
	<div class="space-y-4">
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
							<Table.Cell
								colspan={columns.length}
								class="h-32 text-center"
							>
								<div class="flex flex-col items-center gap-2 text-[#767676]">
									<p class="text-sm">No activity recorded yet.</p>
									<p class="text-xs">Actions like logins and document uploads will appear here.</p>
								</div>
							</Table.Cell>
						</Table.Row>
					{:else}
						{#each table.getRowModel().rows as row (row.id)}
							<Table.Row
								class="border-[#302F2F] transition-colors hover:bg-white/[0.02]"
							>
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
												{#if cellData.full}
													<Tooltip.Root>
														<Tooltip.Trigger>
															{#snippet child({ props })}
																<span
																	{...props}
																	class="cursor-default text-sm text-[#959595]"
																>
																	{cellData.display}
																</span>
															{/snippet}
														</Tooltip.Trigger>
												<Tooltip.Content
													class="max-w-xs break-all rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-black shadow-md"
												>
													{cellData.full}
												</Tooltip.Content>
													</Tooltip.Root>
												{:else}
													<span class="text-sm text-[#959595]">
														{cellData.display}
													</span>
												{/if}
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
															<span
																{...props}
																class="cursor-default text-sm text-[#959595]"
															>
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
			<div class="flex items-center justify-between px-1">
				<p class="text-xs text-[#767676]">
					{(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
					{meta.total === 1 ? 'event' : 'events'}
				</p>
				<div class="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						onclick={previousPage}
						disabled={isLoading || meta.page <= 1}
						class="h-8 cursor-pointer rounded-lg border border-[#302F2F] bg-transparent px-3 text-xs font-normal text-[#959595] hover:border-white/20 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
					>
						<ChevronLeftIcon class="mr-1 size-3.5" />
						Prev
					</Button>
					<span class="min-w-[80px] text-center text-xs text-[#767676]">
						{meta.page} / {meta.totalPages}
					</span>
					<Button
						variant="ghost"
						size="sm"
						onclick={nextPage}
						disabled={isLoading || meta.page >= meta.totalPages}
						class="h-8 cursor-pointer rounded-lg border border-[#302F2F] bg-transparent px-3 text-xs font-normal text-[#959595] hover:border-white/20 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
					>
						Next
						<ChevronRightIcon class="ml-1 size-3.5" />
					</Button>
				</div>
			</div>
		{/if}
	</div>
</Tooltip.Provider>
