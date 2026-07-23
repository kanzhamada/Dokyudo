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
	import type { PageData } from './$types.js';

	/* ── shadcn-svelte Components ── */
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import * as Pagination from '$lib/components/ui/pagination/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';

	/* ── Icons ── */
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SearchIcon from '@lucide/svelte/icons/search';
	import FilterIcon from '@lucide/svelte/icons/filter';
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import XIcon from '@lucide/svelte/icons/x';

	/* ── Third-party ── */
	import { PDFViewer } from '@embedpdf/svelte-pdf-viewer';
	import { toast } from 'svelte-sonner';

	/* ── Local modules ── */
	import { apiRequest } from '$lib/api/client.js';
	import { mobileHeaderState } from '$lib/state/mobile-header.svelte.js';
	import { columns } from './columns.js';
	import type { Document } from './data.js';
	import DocumentCardActions from './document-card-actions.svelte';
	import UploadDocumentDialog from './UploadDocumentDialog.svelte';

	let { data }: { data: PageData } = $props();

	function showError(msg: string) {
		if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
			mobileHeaderState.showError(msg);
		} else {
			toast.error('Error', { description: msg });
		}
	}

	function showSuccess(title: string, msg: string) {
		if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
			mobileHeaderState.showSuccess(title, msg);
		} else {
			toast.success(title, { description: msg });
		}
	}

	async function handlePreview(doc: Document) {
		if (!doc.url) {
			console.log('[Document Preview] Fetching preview URL for:', doc.id);
			const res = await apiRequest<{ url: string; expiresIn: number }>(
				`/api/documents/${doc.id}/preview`
			);
			console.log('[Document Preview] Backend Response:', res);

			if (res.ok) {
				doc.url = res.data.url;
			} else {
				console.error('[Document Preview] Catch Error:', res.error);
				showError(res.error?.message || 'Failed to preview document.');
				return;
			}
		}
		previewDocument = doc;
	}

	/* ── Download Handler (Direct S3 with Attachment Disposition) ── */
	async function handleDownload(doc: Document) {
		console.log('[Document Download] Direct attachment download requested for:', doc.id);

		const res = await apiRequest<{ url: string }>(`/api/documents/${doc.id}/preview?download=true`);
		console.log('[Document Download] Backend Response:', res);

		if (res.ok) {
			const a = document.createElement('a');
			a.href = res.data.url;
			a.download = doc.name;
			a.target = '_blank';
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			showSuccess('Download started', doc.name);
		} else {
			console.error('[Document Download] Catch Error:', res.error);
			showError(res.error?.message || 'Could not fetch download link.');
		}
	}




	/* ── TanStack Table State ── */
	let pagination = $state<PaginationState>({ pageIndex: 0, pageSize: 10 });
	let sorting = $state<SortingState>([]);
	let columnFilters = $state<ColumnFiltersState>([]);
	let globalFilter = $state<string>('');

	let previewDocument = $state<Document | null>(null);
	let uploadDialogOpen = $state(false);

	const table = createSvelteTable({
		get data() {
			return data.documents;
		},
		columns,
		state: {
			get globalFilter() {
				return globalFilter;
			},
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
		globalFilterFn: (row, _columnId, filterValue: string) => {
			if (!filterValue || !filterValue.trim()) return true;
			const searchTerms = filterValue.toLowerCase().trim().split(/\s+/);
			const title = (row.original.name || '').toLowerCase();
			const description = (row.original.description || '').toLowerCase();
			const fullText = `${title} ${description}`;

			return searchTerms.every((term) => fullText.includes(term));
		},
		onGlobalFilterChange: (updater: Updater<string>) => {
			if (typeof updater === 'function') {
				globalFilter = updater(globalFilter);
			} else {
				globalFilter = updater;
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

{#snippet mainList()}
	<Tooltip.Provider>
		<div
			class="flex h-full w-full flex-col gap-6 overflow-y-auto px-6 py-6 font-sans md:px-10 md:py-8"
		>
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

				<Button
					class="cursor-pointer rounded-[6px] bg-[#DB8F5E] font-normal text-white hover:bg-[#C47D4E]"
					onclick={() => (uploadDialogOpen = true)}
				>
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
						placeholder="Search by title or description..."
						value={globalFilter}
						oninput={(e) => (globalFilter = e.currentTarget.value)}
						class="h-10 rounded-full border border-white/[0.16] bg-transparent pl-10 font-normal text-white placeholder:text-white/40 focus-visible:ring-white/20"
					/>
				</div>

				<!-- Filter Button -->
				<DropdownMenu.Root>
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props: tooltipProps })}
								<DropdownMenu.Trigger>
									{#snippet child({ props: dropdownProps })}
										<Button
											{...tooltipProps}
											{...dropdownProps}
											variant="ghost"
											class="h-10 w-10 cursor-pointer rounded-full border border-white/[0.16] bg-transparent px-0 font-normal text-white hover:border-white/[0.80] hover:bg-[#B8B5B5]/[0.40] hover:text-white hover:backdrop-blur-[44.23px] data-[state=open]:border-white/[0.80] data-[state=open]:bg-[#B8B5B5]/[0.40] data-[state=open]:text-white data-[state=open]:backdrop-blur-[44.23px] md:w-auto md:px-4"
										>
											<FilterIcon class="size-4 md:mr-2" />
											<span class="hidden md:inline">Filter</span>
										</Button>
									{/snippet}
								</DropdownMenu.Trigger>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content class=" text-black md:hidden">
							<p>Filter Documents</p>
						</Tooltip.Content>
					</Tooltip.Root>
					<DropdownMenu.Content
						align="end"
						class="w-48 rounded-xl border-white/10 bg-[#2A2A2A] text-white shadow-xl"
					>
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
								class="cursor-pointer text-white hover:bg-white/10 focus:bg-white/10 focus:text-white "
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
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props: tooltipProps })}
								<DropdownMenu.Trigger>
									{#snippet child({ props: dropdownProps })}
										<Button
											{...tooltipProps}
											{...dropdownProps}
											variant="ghost"
											class="h-10 w-10 cursor-pointer rounded-full border border-white/[0.16] bg-transparent px-0 font-normal text-white hover:border-white/[0.80] hover:bg-[#B8B5B5]/[0.40] hover:text-white hover:backdrop-blur-[44.23px] data-[state=open]:border-white/[0.80] data-[state=open]:bg-[#B8B5B5]/[0.40] data-[state=open]:text-white data-[state=open]:backdrop-blur-[44.23px] md:w-auto md:px-4"
										>
											<ArrowUpDownIcon class="size-4 md:mr-2" />
											<span class="hidden md:inline">Sort</span>
										</Button>
									{/snippet}
								</DropdownMenu.Trigger>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content class=" text-black md:hidden">
							<p>Sort Documents</p>
						</Tooltip.Content>
					</Tooltip.Root>
					<DropdownMenu.Content
						align="end"
						class="w-40 rounded-xl border-white/10 bg-[#2A2A2A] text-white shadow-xl"
					>
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
							<DocumentCardActions
								id={doc.id}
								onPreview={() => handlePreview(doc)}
								onDownload={() => handleDownload(doc)}
							/>
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
					<Pagination.Root
						count={totalFilteredRows}
						perPage={10}
						bind:page={uiPage}
						siblingCount={1}
					>
						{#snippet children({ pages, currentPage })}
							<Pagination.Content>
								<Pagination.Item>
									<Pagination.Previous
										class="cursor-pointer text-white hover:bg-white/10 hover:text-white disabled:text-white/20"
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
												class="cursor-pointer text-white hover:bg-white/10 hover:text-white data-[active=true]:border-[#DB8F5E] data-[active=true]:bg-[#DB8F5E]/20 data-[active=true]:text-white"
											>
												{page.value}
											</Pagination.Link>
										</Pagination.Item>
									{/if}
								{/each}

								<Pagination.Item>
									<Pagination.Next
										class="cursor-pointer text-white hover:bg-white/10 hover:text-white disabled:text-white/20"
									/>
								</Pagination.Item>
							</Pagination.Content>
						{/snippet}
					</Pagination.Root>
				</div>
			{/if}
		</div>
	</Tooltip.Provider>
{/snippet}

{#snippet pdfViewer(doc: Document)}
	<div class=" flex h-full w-full flex-col bg-[#191919] p-6">
		<div class="mt-16 mb-4 flex items-start justify-between gap-4 md:mt-0">
			<div class="flex flex-col gap-1">
				<h3 class="line-clamp-1 text-lg font-medium text-white" title={doc.name}>
					{doc.name}
				</h3>
				<p class="text-xs text-[#DB8F5E]/90">
					* Note: Edits made here won't be saved to the database. Please export the document to keep
					your changes.
				</p>
			</div>
			<Button
				variant="ghost"
				size="icon"
				class="cursor-pointer text-white/60 hover:bg-white/5 hover:text-white"
				onclick={() => (previewDocument = null)}
			>
				<XIcon class="size-5" />
			</Button>
		</div>
		<div class="flex-1 overflow-hidden rounded-xl border border-white/10 bg-white/5">
			{#key doc.id}
				<PDFViewer
					class="h-full w-full"
					config={{
						src: doc.url,
						theme: {
							preference: 'dark',
							dark: {
								background: {
									app: '#191919',
									surface: '#2A2A2A',
									surfaceAlt: '#1F1E1D',
									elevated: '#2A2A2A',
									overlay: 'rgba(0, 0, 0, 0.5)',
									input: 'rgba(255, 255, 255, 0.05)'
								},
								foreground: {
									primary: '#ffffff',
									secondary: 'rgba(255, 255, 255, 0.6)',
									muted: 'rgba(255, 255, 255, 0.4)',
									disabled: 'rgba(255, 255, 255, 0.2)',
									onAccent: '#ffffff'
								},
								border: {
									default: 'rgba(255, 255, 255, 0.1)',
									subtle: 'rgba(255, 255, 255, 0.05)',
									strong: 'rgba(255, 255, 255, 0.2)'
								},
								accent: {
									primary: '#DB8F5E',
									primaryHover: '#E59C6D',
									primaryActive: '#F0AA81',
									primaryLight: '#4a2f20',
									primaryForeground: '#ffffff'
								},
								interactive: {
									hover: 'rgba(255, 255, 255, 0.1)',
									active: 'rgba(255, 255, 255, 0.15)',
									selected: 'rgba(219, 143, 94, 0.2)',
									focus: '#DB8F5E',
									focusRing: 'rgba(219, 143, 94, 0.5)'
								},
								state: {
									error: '#ef4444',
									errorLight: 'rgba(239, 68, 68, 0.1)',
									warning: '#eab308',
									warningLight: 'rgba(234, 179, 8, 0.1)',
									success: '#22c55e',
									successLight: 'rgba(34, 197, 94, 0.1)',
									info: '#3b82f6',
									infoLight: 'rgba(59, 130, 246, 0.1)'
								}
							}
						}
					}}
				/>
			{/key}
		</div>
	</div>
{/snippet}

<div class="absolute inset-0 h-full w-full">
	<div class="h-full w-full md:hidden">
		<div class="h-full w-full" class:hidden={previewDocument !== null}>
			{@render mainList()}
		</div>
		{#if previewDocument}
			<div class="h-full w-full">
				{@render pdfViewer(previewDocument)}
			</div>
		{/if}
	</div>
	<div class="hidden h-full w-full md:block">
		{#if previewDocument}
			<Resizable.PaneGroup direction="horizontal" autoSaveId="document-layout">
				<Resizable.Pane defaultSize={60}>
					{@render mainList()}
				</Resizable.Pane>
				<Resizable.Handle
					withHandle
					class="w-1 bg-white/10 hover:bg-[#DB8F5E]/50 active:bg-[#DB8F5E]"
				/>
				<Resizable.Pane defaultSize={40}>
					{@render pdfViewer(previewDocument)}
				</Resizable.Pane>
			</Resizable.PaneGroup>
		{:else}
			{@render mainList()}
		{/if}
	</div>
</div>

<UploadDocumentDialog bind:open={uploadDialogOpen} />
