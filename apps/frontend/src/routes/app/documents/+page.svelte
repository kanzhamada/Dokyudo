<script lang="ts">
	import { untrack } from 'svelte';
	import {
		type ColumnFiltersState,
		type PaginationState,
		type SortingState,
		type Updater,
		getCoreRowModel,
		getFilteredRowModel,
		getPaginationRowModel,
		getSortedRowModel
	} from '@tanstack/table-core';
	import { createSvelteTable } from '$lib/components/ui/data-table/index.js';

	/* ── shadcn-svelte Components ── */
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import * as Pagination from '$lib/components/ui/pagination/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';

	/* ── Icons ── */
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SearchIcon from '@lucide/svelte/icons/search';
	import FilterIcon from '@lucide/svelte/icons/filter';
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';

	/* ── Local modules ── */
	import { columns } from './columns.js';
	import { documents, type Document } from './data.js';
	import DocumentCardActions from './document-card-actions.svelte';

	/* ── TanStack Table State ── */
	let pagination = $state<PaginationState>({ pageIndex: 0, pageSize: 10 });
	let sorting = $state<SortingState>([]);
	let columnFilters = $state<ColumnFiltersState>([]);

	const table = createSvelteTable({
		get data() {
			return documents;
		},
		columns,
		state: {
			get pagination() {
				return pagination;
			},
			get sorting() {
				return sorting;
			},
			get columnFilters() {
				return columnFilters;
			}
		},
		onPaginationChange: (updater: Updater<PaginationState>) => {
			if (typeof updater === 'function') {
				pagination = updater(pagination);
			} else {
				pagination = updater;
			}
		},
		onSortingChange: (updater: Updater<SortingState>) => {
			if (typeof updater === 'function') {
				sorting = updater(sorting);
			} else {
				sorting = updater;
			}
		},
		onColumnFiltersChange: (updater: Updater<ColumnFiltersState>) => {
			if (typeof updater === 'function') {
				columnFilters = updater(columnFilters);
			} else {
				columnFilters = updater;
			}
		},
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel()
	});

	/* ── Derived search value for input binding ── */
	let searchValue = $derived((table.getColumn('name')?.getFilterValue() as string) ?? '');

	/* ── Pagination sync: bits-ui Pagination is 1-indexed, TanStack is 0-indexed ── */
	let uiPage = $state(1);
	let totalFilteredRows = $derived(table.getFilteredRowModel().rows.length);

	$effect(() => {
		// Sync UI page → TanStack (only when user changes page via UI)
		const targetIndex = uiPage - 1;
		if (pagination.pageIndex !== targetIndex) {
			pagination = { ...pagination, pageIndex: targetIndex };
		}
	});

	$effect(() => {
		// Reset to page 1 when filters change and current page exceeds available pages
		const maxPage = Math.max(1, Math.ceil(totalFilteredRows / 10));
		if (uiPage > maxPage) {
			uiPage = 1;
		}
	});

	/* ── Filter state ── */
	let filterPdf = $state(false);
	let filterDocx = $state(false);
	let filterTxt = $state(false);

	$effect(() => {
		const filters: string[] = [];
		if (filterPdf) filters.push('pdf');
		if (filterDocx) filters.push('docx');
		if (filterTxt) filters.push('txt');
		
		untrack(() => {
			table.getColumn('type')?.setFilterValue(filters.length > 0 ? filters : undefined);
		});
	});

	/* ── Sort handler ── */
	function handleSort(columnId: string) {
		const col = table.getColumn(columnId);
		if (col) {
			col.toggleSorting(col.getIsSorted() === 'asc');
		}
	}
</script>

<div class="flex flex-1 flex-col gap-6 px-6 py-6 font-sans md:px-10 md:py-8">
	<!-- Row 1: Breadcrumb -->
	<Breadcrumb.Root class="mt-16 md:mt-0">
		<Breadcrumb.List class="text-sm text-[#767676]">
			<Breadcrumb.Item>
				<Breadcrumb.Link href="/app/dashboard" class="text-[#767676] hover:text-white/70">
					Home
				</Breadcrumb.Link>
			</Breadcrumb.Item>
			<Breadcrumb.Separator class="text-[#767676]" />
			<Breadcrumb.Item>
				<Breadcrumb.Page class="font-medium text-white">Document Library</Breadcrumb.Page>
			</Breadcrumb.Item>
		</Breadcrumb.List>
	</Breadcrumb.Root>

	<!-- Row 2: Header & Primary Action -->
	<div class="flex items-center justify-between">
		<h1 class="text-3xl font-semibold text-white md:text-4xl">Document Library</h1>
		<Button class="cursor-pointer rounded-[6px] bg-[#DB8F5E] font-normal text-white hover:bg-[#C47D4E]">
			<PlusIcon data-icon="inline-start" />
			Add New
		</Button>
	</div>

	<!-- Row 3: Description -->
	<p class="text-sm font-normal text-[#767676] md:text-base">
		Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
	</p>

	<!-- Row 4: Data Table Controls -->
	<div class="flex flex-wrap items-center gap-3 md:gap-4">
		<!-- Search Input -->
		<div class="relative flex-1">
			<SearchIcon
				class="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-white/40"
			/>
			<Input
				placeholder="Search"
				value={searchValue}
				oninput={(e) => table.getColumn('name')?.setFilterValue(e.currentTarget.value)}
				class="h-10 rounded-full border border-white/[0.16] bg-transparent pl-10 font-normal text-white placeholder:text-white/40 focus-visible:ring-white/20"
			/>
		</div>

		<!-- Filter Button -->
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="ghost"
						class="h-10 w-10 px-0 md:w-auto md:px-4 cursor-pointer rounded-full border border-white/[0.16] bg-transparent font-normal text-white hover:border-white/[0.80] hover:bg-[#B8B5B5]/[0.40] hover:text-white hover:backdrop-blur-[44.23px] data-[state=open]:border-white/[0.80] data-[state=open]:bg-[#B8B5B5]/[0.40] data-[state=open]:text-white data-[state=open]:backdrop-blur-[44.23px]"
					>
						<FilterIcon class="size-4 md:mr-2" />
						<span class="hidden md:inline">Filter</span>
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end" class="w-48 rounded-xl border-white/10 bg-[#2A2A2A] text-white shadow-xl">
				<DropdownMenu.Group>
					<DropdownMenu.CheckboxItem
						class="cursor-pointer text-white hover:bg-white/10 focus:bg-white/10 focus:text-white"
						bind:checked={filterPdf}
						closeOnSelect={false}
					>
						PDF Documents
					</DropdownMenu.CheckboxItem>
					<DropdownMenu.CheckboxItem
						class="cursor-pointer text-white hover:bg-white/10 focus:bg-white/10 focus:text-white"
						bind:checked={filterDocx}
						closeOnSelect={false}
					>
						Word Documents (.docx)
					</DropdownMenu.CheckboxItem>
					<DropdownMenu.CheckboxItem
						class="cursor-pointer text-white hover:bg-white/10 focus:bg-white/10 focus:text-white"
						bind:checked={filterTxt}
						closeOnSelect={false}
					>
						Text Files (.txt)
					</DropdownMenu.CheckboxItem>
				</DropdownMenu.Group>
			</DropdownMenu.Content>
		</DropdownMenu.Root>

		<!-- Sort Button -->
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="ghost"
						class="h-10 w-10 px-0 md:w-auto md:px-4 cursor-pointer rounded-full border border-white/[0.16] bg-transparent font-normal text-white hover:border-white/[0.80] hover:bg-[#B8B5B5]/[0.40] hover:text-white hover:backdrop-blur-[44.23px] data-[state=open]:border-white/[0.80] data-[state=open]:bg-[#B8B5B5]/[0.40] data-[state=open]:text-white data-[state=open]:backdrop-blur-[44.23px]"
					>
						<ArrowUpDownIcon class="size-4 md:mr-2" />
						<span class="hidden md:inline">Sort</span>
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end" class="w-40 rounded-xl border-white/10 bg-[#2A2A2A] text-white shadow-xl">
				<DropdownMenu.Group>
					<DropdownMenu.Item
						class="flex cursor-pointer justify-between text-white hover:bg-white/10 focus:bg-white/10 focus:text-white"
						onclick={() => handleSort('name')}
						closeOnSelect={false}
					>
						<span>Alphabet</span>
						{#if table.getColumn('name')?.getIsSorted() === 'asc'}
							<ArrowUpIcon class="size-4" />
						{:else if table.getColumn('name')?.getIsSorted() === 'desc'}
							<ArrowDownIcon class="size-4" />
						{/if}
					</DropdownMenu.Item>
					<DropdownMenu.Item
						class="flex cursor-pointer justify-between text-white hover:bg-white/10 focus:bg-white/10 focus:text-white"
						onclick={() => handleSort('uploadedAt')}
						closeOnSelect={false}
					>
						<span>Date Uploaded</span>
						{#if table.getColumn('uploadedAt')?.getIsSorted() === 'asc'}
							<ArrowUpIcon class="size-4" />
						{:else if table.getColumn('uploadedAt')?.getIsSorted() === 'desc'}
							<ArrowDownIcon class="size-4" />
						{/if}
					</DropdownMenu.Item>
					<DropdownMenu.Item
						class="flex cursor-pointer justify-between text-white hover:bg-white/10 focus:bg-white/10 focus:text-white"
						onclick={() => handleSort('size')}
						closeOnSelect={false}
					>
						<span>Size</span>
						{#if table.getColumn('size')?.getIsSorted() === 'asc'}
							<ArrowUpIcon class="size-4" />
						{:else if table.getColumn('size')?.getIsSorted() === 'desc'}
							<ArrowDownIcon class="size-4" />
						{/if}
					</DropdownMenu.Item>
				</DropdownMenu.Group>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>

	<!-- Row 5: Card List -->
	<div class="flex flex-col gap-4">
		{#each table.getRowModel().rows as row (row.id)}
			{@const doc = row.original as Document}
			<div
				class="group rounded-[22px] border border-[#302F2F] bg-[#191919]/[0.53] p-5 transition-all duration-200 hover:border-[#949494] hover:bg-[#525252]/[0.53] md:p-6"
			>
				<!-- Card Row 1: Header -->
				<div class="flex items-start justify-between gap-3">
					<div class="flex items-center gap-3">
						<FileTextIcon class="size-5 shrink-0 text-[#C5937B]" />
						<span class="text-sm font-normal text-white md:text-base">{doc.name}</span>
					</div>
					<DocumentCardActions id={doc.id} />
				</div>

				<!-- Card Row 2: Description -->
				<p class="mt-2.5 line-clamp-2 text-sm font-normal text-white/80">
					{doc.description}
				</p>

				<!-- Card Row 3: Metadata -->
				<p class="mt-3 text-xs font-normal text-[#959595] md:text-sm">
					Uploaded: {doc.uploadedAt}&nbsp;&nbsp;•&nbsp;&nbsp;Size: {doc.size}
				</p>
			</div>
		{:else}
			<div
				class="flex h-32 items-center justify-center rounded-[22px] border border-[#302F2F] bg-[#191919]/[0.53]"
			>
				<p class="text-sm text-[#959595]">No documents found.</p>
			</div>
		{/each}
	</div>

	<!-- Bottom: Pagination -->
	{#if totalFilteredRows > 10}
		<div class="flex items-center justify-center pt-2">
			<Pagination.Root count={totalFilteredRows} perPage={10} bind:page={uiPage} siblingCount={1}>
				{#snippet children({ pages, currentPage })}
					<Pagination.Content>
						<Pagination.Item>
							<Pagination.Previous
								class="text-white hover:bg-white/10 hover:text-white disabled:text-white/20"
							/>
						</Pagination.Item>

						{#each pages as page (page.key)}
							{#if page.type === 'ellipsis'}
								<Pagination.Item>
									<Pagination.Ellipsis class="text-white/60" />
								</Pagination.Item>
							{:else}
								<Pagination.Item>
									<Pagination.Link
										{page}
										isActive={currentPage === page.value}
										class="text-white hover:bg-white/10 hover:text-white data-[active=true]:border-[#DB8F5E] data-[active=true]:bg-[#DB8F5E]/20 data-[active=true]:text-white"
									>
										{page.value}
									</Pagination.Link>
								</Pagination.Item>
							{/if}
						{/each}

						<Pagination.Item>
							<Pagination.Next
								class="text-white hover:bg-white/10 hover:text-white disabled:text-white/20"
							/>
						</Pagination.Item>
					</Pagination.Content>
				{/snippet}
			</Pagination.Root>
		</div>
	{/if}
</div>
