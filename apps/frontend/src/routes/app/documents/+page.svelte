<script lang="ts">
	import { untrack, onMount } from 'svelte';
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
	import * as Dialog from '$lib/components/ui/dialog/index.js';

	/* ── Icons ── */
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SearchIcon from '@lucide/svelte/icons/search';
	import FilterIcon from '@lucide/svelte/icons/filter';
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import XIcon from '@lucide/svelte/icons/x';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import CheckSquareIcon from '@lucide/svelte/icons/check-square';
	import CheckIcon from '@lucide/svelte/icons/check';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import { createZipArchive } from '$lib/utils/zip';

	/* ── shadcn-svelte Components (ToggleGroup) ── */
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';

	/* ── Third-party ── */
	import { PDFViewer } from '@embedpdf/svelte-pdf-viewer';
	import { toast } from 'svelte-sonner';

	/* ── Local modules ── */
	import { apiRequest } from '$lib/api/client.js';
	import { supabase } from '$lib/supabase/client.js';
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




	/* ── Delete Handler & Dialog State ── */
	let deleteDialogOpen = $state(false);
	let documentToDelete = $state<Document | null>(null);
	let isDeleting = $state(false);

	function promptDelete(doc: Document) {
		documentToDelete = doc;
		deleteDialogOpen = true;
	}

	async function confirmDelete() {
		if (!documentToDelete || isDeleting) return;
		isDeleting = true;

		const target = documentToDelete;
		console.log('[Document Delete] Outbound Payload:', { id: target.id, name: target.name });

		try {
			const res = await apiRequest<{ message?: string }>(`/api/documents/${target.id}`, {
				method: 'DELETE'
			});
			console.log('[Document Delete] Backend Response:', res);

			if (res.ok) {
				documentsList = documentsList.filter((d) => d.id !== target.id);
				if (previewDocument?.id === target.id) {
					previewDocument = null;
				}
				deleteDialogOpen = false;
				documentToDelete = null;
				showSuccess('Document deleted', target.name);
			} else {
				console.error('[Document Delete] Catch Error:', res.error);
				showError(res.error?.message || 'Failed to delete document.');
			}
		} catch (err) {
			console.error('[Document Delete] Unexpected Error:', err);
			showError('Failed to delete document.');
		} finally {
			isDeleting = false;
		}
	}
	async function refreshDocuments() {
		const res = await apiRequest<{ documents: any[] }>('/api/documents');
		if (res.ok) {
			documentsList = res.data.documents.map((doc) => {
				let sizeStr = '';
				const sizeKB = doc.sizeBytes / 1024;
				if (sizeKB > 1024) {
					sizeStr = (sizeKB / 1024).toFixed(1) + ' MB';
				} else {
					sizeStr = sizeKB.toFixed(0) + ' KB';
				}

				return {
					id: doc.id,
					name: doc.title,
					description: doc.description || 'No description provided.',
					uploadedAt: new Date(doc.createdAt).toLocaleDateString('en-US', {
						month: 'short',
						day: 'numeric',
						year: 'numeric'
					}),
					size: sizeStr,
					status: doc.status as Document['status'],
					url: undefined
				};
			});
		}
	}

	onMount(() => {
		console.log('[Supabase Realtime] Subscribing to public:documents changes...');
		const channel = supabase
			.channel('public:documents')
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'documents' },
				(payload) => {
					console.log('[Supabase Realtime] Realtime Payload received:', payload);
					if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
						const updated = payload.new as {
							id: string;
							status: Document['status'];
							description?: string;
						};
						if (updated && updated.id) {
							const idx = documentsList.findIndex((d) => d.id === updated.id);
							if (idx !== -1) {
								if (updated.status) {
									documentsList[idx].status = updated.status;
								}
								if (updated.description) {
									documentsList[idx].description = updated.description;
								}
								documentsList = [...documentsList];

								if (updated.status === 'processed') {
									showSuccess('Document processed', documentsList[idx].name);
								} else if (updated.status === 'failed') {
									showError(`Processing failed for ${documentsList[idx].name}`);
								}
							} else {
								// New document inserted, refresh list
								refreshDocuments();
							}
						}
					}
				}
			)
			.subscribe((status, err) => {
				console.log('[Supabase Realtime] Channel Subscription Status:', status, err || '');
			});

		// Smart Polling Backup: Check every 4 seconds if any document is currently vectorizing/processing
		// const pollInterval = setInterval(() => {
		// 	const hasProcessing = documentsList.some(
		// 		(d) => d.status === 'pending' || d.status === 'confirmed'
		// 	);
		// 	if (hasProcessing) {
		// 		console.log('[Realtime Backup] Auto-refreshing processing documents...');
		// 		refreshDocuments();
		// 	}
		// }, 4000);

		return () => {
			console.log('[Supabase Realtime] Unsubscribing from documents channel...');
			// clearInterval(pollInterval);
			supabase.removeChannel(channel);
		};
	});

	/* ── Reactive documents state for instant UI updates ── */
	let documentsList = $state<Document[]>([]);

	$effect(() => {
		documentsList = data.documents;
	});

	/* ── TanStack Table State ── */
	let pagination = $state<PaginationState>({ pageIndex: 0, pageSize: 10 });
	let sorting = $state<SortingState>([]);
	let columnFilters = $state<ColumnFiltersState>([]);
	let globalFilter = $state<string>('');

	let previewDocument = $state<Document | null>(null);
	let uploadDialogOpen = $state(false);

	/* ── Document Multi-Selection & Batch Delete State ── */
	let selectedDocIds = $state<string[]>([]);
	let selectedCount = $derived(selectedDocIds.length);

	let showBatchDeleteModal = $state(false);
	let isBatchDeleting = $state(false);
	let isBatchDownloading = $state(false);

	async function handleBatchDownload() {
		if (selectedDocIds.length === 0 || isBatchDownloading) return;
		isBatchDownloading = true;

		try {
			const selectedDocs = documentsList.filter((d) => selectedDocIds.includes(d.id));

			if (selectedDocs.length === 1) {
				const doc = selectedDocs[0];
				let url = doc.url;
				if (!url) {
					const res = await apiRequest<{ url: string }>(`/api/documents/${doc.id}/preview`);
					if (res.ok) {
						url = res.data.url;
					} else {
						showError(`Failed to get download URL for ${doc.name}`);
						return;
					}
				}
				const a = document.createElement('a');
				a.href = url;
				a.download = doc.name;
				a.target = '_blank';
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				showSuccess('Downloading file', doc.name);
			} else {
				showSuccess('Preparing ZIP archive...', `Downloading ${selectedDocs.length} files`);
				const zipFiles: Array<{ name: string; data: Uint8Array }> = [];

				for (const doc of selectedDocs) {
					let url = doc.url;
					if (!url) {
						const res = await apiRequest<{ url: string }>(`/api/documents/${doc.id}/preview`);
						if (res.ok) {
							url = res.data.url;
						} else {
							console.error(`Failed to fetch preview URL for ${doc.name}`);
							continue;
						}
					}
					try {
						const fileRes = await fetch(url);
						const arrayBuffer = await fileRes.arrayBuffer();
						zipFiles.push({
							name: doc.name,
							data: new Uint8Array(arrayBuffer)
						});
					} catch (e) {
						console.error(`Error fetching file content for ${doc.name}`, e);
					}
				}

				if (zipFiles.length === 0) {
					showError('Failed to download selected documents.');
					return;
				}

				const zipBlob = createZipArchive(zipFiles);
				const blobUrl = URL.createObjectURL(zipBlob);

				const a = document.createElement('a');
				a.href = blobUrl;
				a.download = `Dokyudo_Documents_${new Date().toISOString().slice(0, 10)}.zip`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(blobUrl);

				showSuccess('ZIP Downloaded', `Successfully archived ${zipFiles.length} files`);
			}
		} catch (err: any) {
			console.error('[Batch Download Error]:', err);
			showError('An error occurred during download.');
		} finally {
			isBatchDownloading = false;
		}
	}

	function toggleSelectDoc(id: string) {
		if (selectedDocIds.includes(id)) {
			selectedDocIds = selectedDocIds.filter((item) => item !== id);
		} else {
			selectedDocIds = [...selectedDocIds, id];
		}
	}

	function selectAllPageDocuments() {
		const currentPageIds = table.getRowModel().rows.map((row) => (row.original as Document).id);
		const combined = new Set([...selectedDocIds, ...currentPageIds]);
		selectedDocIds = Array.from(combined);
	}

	function selectAllTotalDocuments() {
		selectedDocIds = documentsList.map((d) => d.id);
	}

	function clearSelection() {
		selectedDocIds = [];
	}

	async function executeBatchDelete() {
		if (selectedDocIds.length === 0) return;
		isBatchDeleting = true;
		console.log('[Batch Delete] Executing batch delete for:', selectedDocIds);

		const res = await apiRequest<{ deletedCount: number }>('/api/documents/batch-delete', {
			method: 'POST',
			body: { documentIds: selectedDocIds }
		});

		if (res.ok) {
			const count = selectedDocIds.length;
			documentsList = documentsList.filter((d) => !selectedDocIds.includes(d.id));
			if (previewDocument && selectedDocIds.includes(previewDocument.id)) {
				previewDocument = null;
			}
			selectedDocIds = [];
			showBatchDeleteModal = false;
			showSuccess(
				'Documents deleted',
				`Successfully deleted ${count} ${count === 1 ? 'document' : 'documents'}`
			);
		} else {
			showError(res.error?.message || 'Failed to delete documents');
		}
		isBatchDeleting = false;
	}

	const table = createSvelteTable({
		get data() {
			return documentsList;
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

	/* ── Search Mode State ── */
	let searchMode = $state('keyword');
	let semanticSearchQuery = $state('');
	let isSemanticSearching = $state(false);

	async function executeSemanticSearch() {
		if (!semanticSearchQuery.trim()) {
			refreshDocuments();
			return;
		}
		isSemanticSearching = true;
		const res = await apiRequest<{ data: any[] }>(`/api/search?query=${encodeURIComponent(semanticSearchQuery)}&limit=10`);
		isSemanticSearching = false;

		if (res.ok) {
			const searchResults = res.data.data || [];

			// Replace documentsList with mapped semantic search results
			documentsList = searchResults.map((resultDoc: any) => {
				const originalDoc = data.documents.find((d: any) => d.id === resultDoc.documentId);

				return {
					id: resultDoc.documentId,
					name: originalDoc?.name || 'Unknown Document',
					description: originalDoc?.description || 'No description provided.',
					uploadedAt: originalDoc?.uploadedAt || 'Unknown Date',
					size: originalDoc?.size || '0 KB',
					status: (originalDoc?.status || 'processed') as Document['status'],
					url: undefined,
					pages: resultDoc.metadata?.pages || [],
					score: resultDoc.score,
					semanticContent: resultDoc.content
				};
			});
		} else {
			showError(res.error?.message || 'Semantic search failed.');
		}
	}

	let expandedDocs = $state<string[]>([]);

	$effect(() => {
		if (searchMode === 'keyword') {
			// Restore list from latest payload or re-fetch
			refreshDocuments();
			semanticSearchQuery = '';
		} else {
			globalFilter = '';
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
				<!-- Search Input with Integrated Toggle -->
				<div class="relative flex-1">
					<!-- Toggle Group positioned absolutely inside the input on the left -->
					<div class="absolute left-1.5 top-1/2 flex -translate-y-1/2 items-center z-10">
						<ToggleGroup.Root
							type="single"
							bind:value={searchMode}
							class="flex h-8 items-center rounded-full bg-[#191919]/[0.80] p-1 backdrop-blur-md border border-white/10"
						>
							<ToggleGroup.Item
								value="keyword"
								aria-label="Toggle keyword search"
								class="h-6 w-8 flex items-center justify-center rounded-full text-white/50 hover:text-white/80 data-[state=on]:bg-[#DB8F5E] data-[state=on]:text-white transition-all cursor-pointer"
							>
								<Tooltip.Root>
									<Tooltip.Trigger>
										{#snippet child({ props })}
											<div {...props} class="flex h-full w-full items-center justify-center">
												<SearchIcon class="size-3.5" />
											</div>
										{/snippet}
									</Tooltip.Trigger>
									<Tooltip.Content class="rounded-md bg-white px-2 py-1 text-xs text-black">
										Keyword Search
									</Tooltip.Content>
								</Tooltip.Root>
							</ToggleGroup.Item>
							<ToggleGroup.Item
								value="semantic"
								aria-label="Toggle semantic search"
								class="h-6 w-8 flex items-center justify-center rounded-full text-white/50 hover:text-white/80 data-[state=on]:bg-[#DB8F5E] data-[state=on]:text-white transition-all cursor-pointer"
							>
								<Tooltip.Root>
									<Tooltip.Trigger>
										{#snippet child({ props })}
											<div {...props} class="flex h-full w-full items-center justify-center">
												<BookOpenIcon class="size-3.5" />
											</div>
										{/snippet}
									</Tooltip.Trigger>
									<Tooltip.Content class="rounded-md bg-white px-2 py-1 text-xs text-black">
										AI Hybrid Search
									</Tooltip.Content>
								</Tooltip.Root>
							</ToggleGroup.Item>
						</ToggleGroup.Root>
					</div>

					<Input
						placeholder={searchMode === 'keyword' ? "Search by title or description..." : "Ask AI about your documents (Press Enter)..."}
						value={searchMode === 'keyword' ? globalFilter : semanticSearchQuery}
						oninput={(e) => {
							if (searchMode === 'keyword') {
								globalFilter = e.currentTarget.value;
							} else {
								semanticSearchQuery = e.currentTarget.value;
							}
						}}
						onkeydown={(e) => {
							if (searchMode === 'semantic' && e.key === 'Enter') {
								executeSemanticSearch();
							}
						}}
						class="h-10 rounded-full border border-white/[0.16] bg-transparent pl-[88px] pr-10 font-normal text-white placeholder:text-white/40 focus-visible:ring-white/20 transition-all"
					/>

					<!-- Loading Spinner or Clear Button on the right -->
					<div class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
						{#if isSemanticSearching}
							<Loader2Icon class="size-4 animate-spin text-[#DB8F5E]" />
						{:else if (searchMode === 'keyword' && globalFilter) || (searchMode === 'semantic' && semanticSearchQuery)}
							<button
								type="button"
								onclick={() => {
									if (searchMode === 'keyword') {
										globalFilter = '';
									} else {
										semanticSearchQuery = '';
										refreshDocuments();
									}
								}}
								class="flex size-5 items-center justify-center rounded-full text-white/50 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
								aria-label="Clear search"
							>
								<XIcon class="size-3.5" />
							</button>
						{/if}
					</div>
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
											disabled={searchMode === 'semantic'}
											class="h-10 w-10 cursor-pointer rounded-full border border-white/[0.16] bg-transparent p-0 font-normal text-white hover:border-white/[0.80] hover:bg-[#B8B5B5]/[0.40] hover:text-white hover:backdrop-blur-[44.23px] data-[state=open]:border-white/[0.80] data-[state=open]:bg-[#B8B5B5]/[0.40] data-[state=open]:text-white data-[state=open]:backdrop-blur-[44.23px] disabled:opacity-50"
										>
											<FilterIcon class="size-4" />
										</Button>
									{/snippet}
								</DropdownMenu.Trigger>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md">
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
											disabled={searchMode === 'semantic'}
											class="h-10 w-10 cursor-pointer rounded-full border border-white/[0.16] bg-transparent p-0 font-normal text-white hover:border-white/[0.80] hover:bg-[#B8B5B5]/[0.40] hover:text-white hover:backdrop-blur-[44.23px] data-[state=open]:border-white/[0.80] data-[state=open]:bg-[#B8B5B5]/[0.40] data-[state=open]:text-white data-[state=open]:backdrop-blur-[44.23px] disabled:opacity-50"
										>
											<ArrowUpDownIcon class="size-4" />
										</Button>
									{/snippet}
								</DropdownMenu.Trigger>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md">
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

				<!-- Select Button & Dropdown -->
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
											class="h-10 cursor-pointer rounded-full border border-white/[0.16] bg-transparent font-normal text-white hover:border-white/[0.80] hover:bg-[#B8B5B5]/[0.40] hover:text-white hover:backdrop-blur-[44.23px] data-[state=open]:border-white/[0.80] data-[state=open]:bg-[#B8B5B5]/[0.40] data-[state=open]:text-white data-[state=open]:backdrop-blur-[44.23px] {selectedCount > 0 ? 'border-white/[0.80] bg-[#B8B5B5]/[0.40] px-3' : 'w-10 p-0 flex items-center justify-center'}"
										>
											<CheckSquareIcon class="size-4" />
											{#if selectedCount > 0}
												<span class="ml-1.5 text-xs font-semibold">{selectedCount}</span>
											{/if}
										</Button>
									{/snippet}
								</DropdownMenu.Trigger>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md">
							<p>{selectedCount > 0 ? `Selected Documents (${selectedCount})` : 'Select Documents'}</p>
						</Tooltip.Content>
					</Tooltip.Root>
					<DropdownMenu.Content
						align="end"
						class="w-56 rounded-xl border-white/10 bg-[#2A2A2A] text-white shadow-xl"
					>
						<DropdownMenu.Group>
							<DropdownMenu.Item
								class="flex cursor-pointer items-center justify-between text-white hover:bg-white/10 focus:bg-white/10 focus:text-white"
								onclick={selectAllPageDocuments}
							>
								<span>Select page ({table.getRowModel().rows.length})</span>
							</DropdownMenu.Item>
							<DropdownMenu.Item
								class="flex cursor-pointer items-center justify-between text-white hover:bg-white/10 focus:bg-white/10 focus:text-white"
								onclick={selectAllTotalDocuments}
							>
								<span>Select all ({documentsList.length})</span>
							</DropdownMenu.Item>
							{#if selectedCount > 0}
								<DropdownMenu.Separator class="bg-white/10" />
								<DropdownMenu.Item
									class="flex cursor-pointer items-center justify-between text-white/70 hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white"
									onclick={clearSelection}
								>
									<span>Deselect all ({selectedCount})</span>
								</DropdownMenu.Item>
							{/if}
						</DropdownMenu.Group>
					</DropdownMenu.Content>
				</DropdownMenu.Root>

				{#if selectedCount > 0}
					<!-- Batch Download Button -->
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<Button
									{...props}
									type="button"
									variant="ghost"
									disabled={isBatchDownloading}
									onclick={handleBatchDownload}
									class="h-10 cursor-pointer rounded-full border border-blue-500/40 bg-blue-950/40 px-3 text-sm font-medium text-blue-400 hover:bg-blue-900/60 hover:text-blue-300 transition-colors flex items-center justify-center disabled:opacity-50"
								>
									{#if isBatchDownloading}
										<Loader2Icon class="size-4 animate-spin" />
									{:else}
										<DownloadIcon class="size-4" />
									{/if}
									<span class="ml-1.5 text-xs font-semibold">{selectedCount}</span>
								</Button>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md">
							<p>{selectedCount > 1 ? `Download Selected as ZIP (${selectedCount})` : `Download Selected Document`}</p>
						</Tooltip.Content>
					</Tooltip.Root>

					<!-- Batch Delete Button -->
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<Button
									{...props}
									type="button"
									variant="ghost"
									onclick={() => (showBatchDeleteModal = true)}
									class="h-10 cursor-pointer rounded-full border border-red-500/40 bg-red-950/40 px-3 text-sm font-medium text-red-400 hover:bg-red-900/60 hover:text-red-300 transition-colors flex items-center justify-center"
								>
									<Trash2Icon class="size-4" />
									<span class="ml-1.5 text-xs font-semibold">{selectedCount}</span>
								</Button>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md">
							<p>Delete Selected Documents ({selectedCount})</p>
						</Tooltip.Content>
					</Tooltip.Root>
				{/if}
			</div>

			<!-- Row 5: Card List -->
			<div class="flex flex-col gap-4">
				{#each table.getRowModel().rows as row (row.id)}
					{@const doc = row.original as Document}
					{@const isSelected = selectedDocIds.includes(doc.id)}
					<div
						role="button"
						tabindex="0"
						onclick={() => toggleSelectDoc(doc.id)}
						onkeydown={(e) => e.key === 'Enter' && toggleSelectDoc(doc.id)}
						class="group relative cursor-pointer rounded-[22px] border p-5 transition-all duration-200 md:p-6 {isSelected
							? 'border-[#949494] bg-[#525252]/[0.53]'
							: 'border-[#302F2F] bg-[#191919]/[0.53] hover:border-[#949494] hover:bg-[#525252]/[0.53]'}"
					>
						<!-- Card Row 1: Header -->
						<div class="flex items-start justify-between gap-3">
							<div class="flex items-center gap-3">
								<FileTextIcon class="size-5 shrink-0 text-[#C5937B]" />
								<span class="text-sm font-normal text-white md:text-base">{doc.name}</span>
							</div>
							<div class="flex items-center gap-3" onclick={(e) => e.stopPropagation()} role="none">
								{#if doc.score !== undefined}
									<div
										class="rounded-full border border-[#DB8F5E]/30 bg-[#DB8F5E]/10 px-2 py-0.5 text-xs font-semibold text-[#DB8F5E]"
										title="AI Relevance Score"
									>
										{(doc.score * 100).toFixed(2)}% Match
									</div>
								{/if}
								<DocumentCardActions
									id={doc.id}
									onPreview={() => handlePreview(doc)}
									onDownload={() => handleDownload(doc)}
									onDelete={() => promptDelete(doc)}
								/>
							</div>
						</div>

						<!-- Card Row 2: Description -->
						{#if (doc.status === 'pending' || doc.status === 'confirmed') && (!doc.description || doc.description === 'No description provided.')}
							<div
								class="mt-2.5 flex items-center gap-2 text-sm font-normal text-white/50 italic animate-pulse"
							>
								<SparklesIcon class="size-3.5 shrink-0 text-white/70" />
								<span>Generating summary with AI...</span>
							</div>
						{:else if doc.status === 'quota_exhausted' && (!doc.description || doc.description === 'No description provided.')}
							<div
								class="mt-2.5 flex items-center gap-2 text-sm font-normal text-amber-400/70 italic"
							>
								<ClockIcon class="size-3.5 shrink-0 text-amber-400" />
								<span>Summary generation paused due to daily quota. Resuming tomorrow.</span>
							</div>
						{:else}
							<p class="mt-2.5 line-clamp-2 text-sm font-normal text-white/80">
								{doc.description}
							</p>
						{/if}

						{#if doc.semanticContent}
							<div class="mt-4 relative overflow-hidden rounded-xl border border-[#DB8F5E]/20 bg-[#1A1512] p-4">
								<div class="absolute left-0 top-0 h-full w-1 bg-[#DB8F5E]/50"></div>
								<div class="flex cursor-pointer items-center justify-between" onclick={(e) => {
									e.stopPropagation();
									if (expandedDocs.includes(doc.id)) {
										expandedDocs = expandedDocs.filter(id => id !== doc.id);
									} else {
										expandedDocs = [...expandedDocs, doc.id];
									}
								}} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && e.stopPropagation()}>
									<div class="flex items-center gap-2 text-[#DB8F5E]">
										<BookOpenIcon class="size-4" />
										<span class="text-sm font-medium">Relevant Chunk</span>
									</div>
									<Button variant="ghost" size="sm" class="h-6 px-2 text-xs text-[#DB8F5E] hover:bg-[#DB8F5E]/20 hover:text-[#DB8F5E]">
										{expandedDocs.includes(doc.id) ? 'Collapse' : 'Expand'}
									</Button>
								</div>

								<div class="mt-3 text-sm font-normal text-white/80 transition-all duration-300 {expandedDocs.includes(doc.id) ? '' : 'line-clamp-3'}" >
									{doc.semanticContent}
								</div>
							</div>
						{/if}

						<!-- Card Row 3: Metadata & Real-time Status Badge -->
						<div class="mt-3 flex items-center justify-between gap-2">
							<div class="flex items-center gap-3">
								<p class="text-xs font-normal text-[#959595] md:text-sm">
									Uploaded: {doc.uploadedAt}&nbsp;&nbsp;•&nbsp;&nbsp;Size: {doc.size}
								</p>

								{#if doc.pages && doc.pages.length > 0}
									<div
										class="inline-flex items-center gap-1.5 rounded-full border border-[#DB8F5E]/30 bg-[#DB8F5E]/10 px-2.5 py-0.5 text-xs font-medium text-[#DB8F5E]"
										title={`Found on pages: ${doc.pages.join(', ')}`}
									>
										<BookOpenIcon class="size-3.5" />
										<span>Pages: {doc.pages.slice(0, 3).join(', ')}{doc.pages.length > 3 ? '...' : ''}</span>
									</div>
								{/if}
							</div>

							<!-- Vectorizing / Quota / Failed Status Badge -->
							{#if doc.status === 'pending' || doc.status === 'confirmed'}
								<div
									class="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white/90 shadow-sm backdrop-blur-md transition-all duration-300 group-hover:border-white/30 group-hover:bg-white/20"
								>
									<SparklesIcon class="size-3.5 animate-pulse text-white" />
									<span class="tracking-wide">Vectorizing...</span>
								</div>
							{:else if doc.status === 'quota_exhausted'}
								<Tooltip.Root>
									<Tooltip.Trigger>
										{#snippet child({ props })}
											<div
												{...props}
												class="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-950/40 px-2.5 py-0.5 text-xs font-medium text-amber-300 shadow-sm backdrop-blur-md cursor-help"
											>
												<ClockIcon class="size-3.5 text-amber-400" />
												<span class="tracking-wide font-medium">Resuming Tomorrow</span>
											</div>
										{/snippet}
									</Tooltip.Trigger>
									<Tooltip.Content class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md max-w-xs">
										<p>Daily AI quota reached. Vectorizing will resume tomorrow at 00:00 UTC.</p>
									</Tooltip.Content>
								</Tooltip.Root>
							{:else if doc.status === 'failed_vectorizing'}
								<div
									class="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-950/40 px-2.5 py-0.5 text-xs font-medium text-red-400 shadow-sm backdrop-blur-md"
								>
									<XIcon class="size-3.5 text-red-400" />
									<span class="tracking-wide font-medium">Failed Vectorizing</span>
								</div>
							{:else if doc.status === 'failed'}
								<div
									class="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-950/40 px-2.5 py-0.5 text-xs font-medium text-red-400 shadow-sm backdrop-blur-md"
								>
									<XIcon class="size-3.5 text-red-400" />
									<span class="tracking-wide font-medium">Processing Failed</span>
								</div>
							{/if}
						</div>
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
					onready={(registry: any) => {
						const targetPage = doc.pages && doc.pages.length > 0 ? doc.pages[0] : undefined;
						if (targetPage) {
							const scrollPlugin = registry.getPlugin('scroll');
							if (scrollPlugin && scrollPlugin.provides) {
								const scrollCap = scrollPlugin.provides();
								scrollCap.onLayoutReady((event: any) => {
									if (event.isInitial) {
										scrollCap.scrollToPage({ pageNumber: targetPage });
									}
								});
							}
						}
					}}
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

<UploadDocumentDialog bind:open={uploadDialogOpen} onSuccess={refreshDocuments} />

<!-- Delete Confirmation Dialog -->
<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content
		class="w-full max-w-md rounded-2xl border border-white/10 bg-[#2A2A2A] p-6 text-white shadow-2xl"
	>
		<Dialog.Header>
			<Dialog.Title class="text-xl font-semibold text-white">Delete Document</Dialog.Title>
			<Dialog.Description class="mt-2 text-sm text-[#959595]">
				Are you sure you want to delete <span class="font-medium text-white">{documentToDelete?.name}</span>? This action cannot be undone.
			</Dialog.Description>
		</Dialog.Header>

		<Dialog.Footer class="mt-6 flex items-center justify-end gap-3">
			<Button
				variant="ghost"
				class="cursor-pointer text-white/70 hover:bg-white/10 hover:text-white"
				disabled={isDeleting}
				onclick={() => (deleteDialogOpen = false)}
			>
				Cancel
			</Button>
			<Button
				class="cursor-pointer bg-red-600 font-normal text-white hover:bg-red-700 disabled:opacity-50"
				disabled={isDeleting}
				onclick={confirmDelete}
			>
				{#if isDeleting}
					<Loader2Icon class="mr-2 size-4 animate-spin" />
					Deleting...
				{:else}
					Delete
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Batch Delete Confirmation Modal -->
<Dialog.Root bind:open={showBatchDeleteModal}>
	<Dialog.Content class="border-[#302F2F] bg-[#191919] text-white sm:max-w-md sm:rounded-[22px]">
		<Dialog.Header class="gap-2">
			<Dialog.Title class="text-xl font-semibold text-white">
				Delete {selectedCount} {selectedCount === 1 ? 'Document' : 'Documents'}?
			</Dialog.Title>
			<Dialog.Description class="text-sm text-[#767676]">
				This action will permanently delete {selectedCount} selected {selectedCount === 1
					? 'document'
					: 'documents'}, their vector embeddings, and storage files. This process cannot be undone.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer class="mt-4 flex flex-row justify-end gap-3">
			<Button
				type="button"
				variant="ghost"
				onclick={() => (showBatchDeleteModal = false)}
				disabled={isBatchDeleting}
				class="cursor-pointer text-sm text-white hover:bg-white/10"
			>
				Cancel
			</Button>
			<Button
				type="button"
				onclick={executeBatchDelete}
				disabled={isBatchDeleting}
				class="cursor-pointer border border-red-500/40 bg-red-950/60 font-medium text-red-400 hover:bg-red-900/80 hover:text-red-300 disabled:opacity-50"
			>
				{#if isBatchDeleting}
					<Loader2Icon class="mr-2 size-4 animate-spin" />
					Deleting...
				{:else}
					Delete {selectedCount} {selectedCount === 1 ? 'Document' : 'Documents'}
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
