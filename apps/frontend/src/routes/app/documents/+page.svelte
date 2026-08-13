<script lang="ts">
	import { untrack, onMount } from 'svelte';
	import { scale } from 'svelte/transition';
	import { page } from '$app/state';
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
	import * as Resizable from '$lib/components/ui/resizable/index.js';
	import * as Tooltip from '$lib/components/ui/tooltip/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';

	/* ── Icons ── */
	import PlusIcon from '@lucide/svelte/icons/plus';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import XIcon from '@lucide/svelte/icons/x';
	import Loader2Icon from '@lucide/svelte/icons/loader-2';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import CheckSquareIcon from '@lucide/svelte/icons/check-square';
	import CheckIcon from '@lucide/svelte/icons/check';
	import BookOpenIcon from '@lucide/svelte/icons/book-open';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import FilesIcon from '@lucide/svelte/icons/files';
	import FileStackIcon from '@lucide/svelte/icons/file-stack';
	import ArrowDownAZIcon from '@lucide/svelte/icons/arrow-down-a-z';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import HardDriveIcon from '@lucide/svelte/icons/hard-drive';
	import ListChecksIcon from '@lucide/svelte/icons/list-checks';
	import ListIcon from '@lucide/svelte/icons/list';
	import ListXIcon from '@lucide/svelte/icons/list-x';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import MxIcon from '$lib/components/icons/MxIcon.svelte';
	import { createZipArchive } from '$lib/utils/zip';

	/* ── shadcn-svelte Components (ToggleGroup) ── */
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';

	/* ── Third-party ── */
	import { PDFViewer } from '@embedpdf/svelte-pdf-viewer';
	import { toast } from 'svelte-sonner';

	/* ── Local modules ── */
	import { apiRequest } from '$lib/api/client.js';
	import { getMeUsageCached } from '$lib/state/me-cache.store.svelte';
	import { TIER_LIMITS, type TierType } from '$lib/constants/tiers.constant';
	import { supabase } from '$lib/supabase/client.js';
	import { mobileHeaderState } from '$lib/state/mobile-header.svelte.js';
	import { columns } from './columns.js';
	import type { Document } from './data.js';
	import DocumentCardActions from './document-card-actions.svelte';
	import UploadDocumentDialog from './UploadDocumentDialog.svelte';
	import ConfirmDeleteDialog from '$lib/components/app/ConfirmDeleteDialog.svelte';
	import PdfPreviewPanel from '$lib/components/app/PdfPreviewPanel.svelte';

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

	/** True while the document is still being vectorized (realtime-updated). */
	function isVectorizing(doc: Document): boolean {
		return doc.status === 'pending' || doc.status === 'confirmed';
	}

	function isPdfDocument(doc: Document): boolean {
		return doc.name.toLowerCase().endsWith('.pdf');
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
				totalDocumentCount = Math.max(0, totalDocumentCount - 1);
				void loadUsage();
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

	function formatStorage(bytes: number): string {
		if (bytes >= 1024 * 1024 * 1024) {
			return `${Number((bytes / (1024 * 1024 * 1024)).toFixed(1))} GB`;
		}
		return `${Number((bytes / (1024 * 1024)).toFixed(1))} MB`;
	}

	/* ── Rename (Edit Title) State & Handler ── */
	/* Mirror of the backend whitelist (documents.schema.ts DOCUMENT_TITLE_REGEX):
	   Unicode letters, digits, spaces, and a small set of safe punctuation.
	   The backend zod schema is the source of truth; this only gives instant
	   feedback before hitting the API. */
	const TITLE_ALLOWED_REGEX = /^[\p{L}\p{N} .\-_,&+@#:!?()]+$/u;

	let renameDialogOpen = $state(false);
	let documentToRename = $state<Document | null>(null);
	let renameBaseValue = $state('');
	let renameError = $state('');
	let isRenaming = $state(false);

	function getDocumentExtension(name: string): string {
		const lastDot = name.lastIndexOf('.');
		return lastDot > 0 ? name.slice(lastDot) : '';
	}

	function promptRename(doc: Document) {
		documentToRename = doc;
		renameBaseValue = getDocumentExtension(doc.name)
			? doc.name.slice(0, doc.name.lastIndexOf('.'))
			: doc.name;
		renameError = '';
		renameDialogOpen = true;
	}

	async function confirmRename() {
		if (!documentToRename || isRenaming) return;

		const ext = getDocumentExtension(documentToRename.name);
		const base = renameBaseValue.trim();
		const newTitle = base + ext;

		if (!base) {
			renameError = 'Title cannot be empty.';
			return;
		}
		if (newTitle.length > 255) {
			renameError = 'Title must be at most 255 characters.';
			return;
		}
		if (!TITLE_ALLOWED_REGEX.test(base)) {
			renameError =
				'Title contains disallowed characters. Allowed: letters, digits, spaces, and . , - _ ( ) & + @ # : ! ?';
			return;
		}

		isRenaming = true;
		renameError = '';
		const target = documentToRename;

		try {
			const res = await apiRequest<{ success: boolean; title: string; message?: string }>(
				`/api/documents/${target.id}`,
				{ method: 'PATCH', body: { title: newTitle } }
			);
			console.log('[Document Rename] Backend Response:', res);

			if (res.ok) {
				const idx = documentsList.findIndex((d) => d.id === target.id);
				if (idx !== -1) {
					// url reset: invalidates any cached presigned URL so a later
					// download/preview refetches one carrying the new filename.
					documentsList[idx] = { ...documentsList[idx], name: res.data.title, url: undefined };
					documentsList = [...documentsList];
				}
				renameDialogOpen = false;
				documentToRename = null;
				showSuccess('Document renamed', res.data.title);
			} else {
				console.error('[Document Rename] Catch Error:', res.error);
				renameError = res.error?.message || 'Failed to rename document.';
			}
		} catch (err) {
			console.error('[Document Rename] Unexpected Error:', err);
			renameError = 'Failed to rename document.';
		} finally {
			isRenaming = false;
		}
	}

	async function loadUsage(): Promise<boolean> {
		try {
			const res = await getMeUsageCached();
			if (!res.ok) {
				console.error('[Document Library] Failed to load usage:', res.error);
				return false;
			}

			uploadsCount = res.data.uploadsCount;
			storageUsedBytes = res.data.storageUsedBytes;
			const tier = (res.data.tier as TierType) ?? 'FREE';
			const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.FREE;
			maxUploads = limits.maxUploadsPerMonth;
			maxStorageBytes = limits.maxStorageBytes;
			return true;
		} catch (err) {
			console.error('[Document Library] Unexpected usage error:', err);
			return false;
		}
	}

	async function refreshDocuments(): Promise<boolean> {
		const res = await apiRequest<{ documents: any[] }>('/api/documents');
		if (!res.ok) return false;

		totalDocumentCount = res.data.documents.length;
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
				createdAt: doc.createdAt,
				size: sizeStr,
				status: doc.status as Document['status'],
				url: undefined
			};
		});
		return true;
	}

	async function refreshPage() {
		if (isRefreshing) return;
		isRefreshing = true;

		try {
			const [documentsRefreshed, usageRefreshed] = await Promise.all([
				refreshDocuments(),
				loadUsage()
			]);
			if (!documentsRefreshed || !usageRefreshed) {
				showError('Failed to refresh document data.');
			}
		} finally {
			isRefreshing = false;
		}
	}

	onMount(() => {
		// Incoming search from the /app/chat landing search bar (animated view
		// transition): run the submitted query immediately. `mode` maps the
		// Sparkles toggle — 'semantic' (AI) or 'keyword'.
		const incomingQuery = page.url.searchParams.get('q');
		const incomingMode = page.url.searchParams.get('mode');
		if (incomingQuery && incomingQuery.trim()) {
			searchMode = incomingMode === 'semantic' ? 'semantic' : 'keyword';
			if (searchMode === 'semantic') {
				semanticSearchQuery = incomingQuery;
				executeSemanticSearch();
			} else {
				globalFilter = incomingQuery;
			}
		}
		void loadUsage();

		console.log('[Supabase Realtime] Subscribing to public:documents changes...');
		const channel = supabase
			.channel('public:documents')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, (payload) => {
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
							const prevStatus = documentsList[idx].status;
							if (updated.status && updated.status !== prevStatus) {
								documentsList[idx].status = updated.status;
							}
							if (updated.description) {
								documentsList[idx].description = updated.description;
							}
							documentsList = [...documentsList];

							// Toast only on a real status transition. Updates that touch
							// other columns (e.g. a title rename) re-broadcast the same
							// status and must not re-fire "Document processed".
							if (updated.status && updated.status !== prevStatus) {
								if (updated.status === 'processed') {
									showSuccess('Document processed', documentsList[idx].name);
								} else if (updated.status === 'failed') {
									showError(`Processing failed for ${documentsList[idx].name}`);
								}
							}
						} else {
							// New document inserted, refresh list
							void Promise.all([refreshDocuments(), loadUsage()]);
						}
					}
				}
			})
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
		const resetInterval = setInterval(() => {
			currentTime = Date.now();
		}, 1000);

		return () => {
			console.log('[Supabase Realtime] Unsubscribing from documents channel...');
			// clearInterval(pollInterval);
			clearInterval(resetInterval);
			supabase.removeChannel(channel);
		};
	});

	/* ── Reactive documents state for instant UI updates ── */
	let documentsList = $state<Document[]>([]);
	let totalDocumentCount = $state(0);
	let uploadsCount = $state(0);
	let maxUploads = $state(TIER_LIMITS.FREE.maxUploadsPerMonth);
	let storageUsedBytes = $state(0);
	let maxStorageBytes = $state(TIER_LIMITS.FREE.maxStorageBytes);
	let isRefreshing = $state(false);
	let currentTime = $state(Date.now());
	let uploadUsageDisplay = $derived(`${uploadsCount} / ${maxUploads}`);
	let storageUsageDisplay = $derived(
		`${formatStorage(storageUsedBytes)} / ${formatStorage(maxStorageBytes)}`
	);
	let storageUsagePercent = $derived(
		maxStorageBytes > 0 ? Math.min(100, Math.round((storageUsedBytes / maxStorageBytes) * 100)) : 0
	);
	let storageNearLimit = $derived(storageUsagePercent >= 90);
	let uploadResetCountdown = $derived.by(() => {
		const now = new Date(currentTime);
		const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
		const remainingMinutes = Math.max(
			0,
			Math.ceil((nextMonth.getTime() - currentTime) / (1000 * 60))
		);
		const days = Math.floor(remainingMinutes / (24 * 60));
		const hours = Math.floor((remainingMinutes % (24 * 60)) / 60);
		const minutes = remainingMinutes % 60;

		return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
	});

	$effect(() => {
		documentsList = data.documents;
		totalDocumentCount = data.documents.length;
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

	/* Cards that are being deselected — play the reverse glass animation once */
	let deselectedCardIds = $state<string[]>([]);

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
			deselectedCardIds = [...deselectedCardIds.filter((item) => item !== id), id];
			setTimeout(() => {
				deselectedCardIds = deselectedCardIds.filter((item) => item !== id);
			}, 700);
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
			totalDocumentCount = Math.max(0, totalDocumentCount - count);
			void loadUsage();
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
	let totalPages = $derived(Math.max(1, Math.ceil(totalFilteredRows / pagination.pageSize)));
	let paginationRange = $derived.by(() => ({
		start: totalFilteredRows === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1,
		end: Math.min((pagination.pageIndex + 1) * pagination.pageSize, totalFilteredRows)
	}));

	$effect(() => {
		// Sync UI page → TanStack (only when user changes page via UI)
		const targetIndex = uiPage - 1;
		if (pagination.pageIndex !== targetIndex) {
			pagination = { ...pagination, pageIndex: targetIndex };
		}
	});

	$effect(() => {
		// Reset to page 1 when filters change and current page exceeds available pages
		if (uiPage > totalPages) {
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
		const res = await apiRequest<{ data: any[] }>(
			`/api/search?query=${encodeURIComponent(semanticSearchQuery)}&limit=10`
		);
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
					createdAt: originalDoc?.createdAt || '',
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

	function escapeHtml(str: string): string {
		return str
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	/* Wrap words from the search query in <mark class="match-highlight"> so
	   the matched excerpt reads like a stabilo-annotated snippet. Case-
	   insensitive substring matching, so "pajak" also flags "perPajakan". */
	function highlightMatch(text: string, query: string): string {
		const escaped = escapeHtml(text);
		const terms = query
			.toLowerCase()
			.split(/\s+/)
			.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
			.filter((t) => t.length >= 3);
		if (terms.length === 0) return escaped;

		const regex = new RegExp(`(${terms.join('|')})`, 'gi');
		return escaped.replace(regex, '<mark class="match-highlight">$1</mark>');
	}

	let activeSearchQuery = $derived(searchMode === 'semantic' ? semanticSearchQuery : globalFilter);

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

	/* ── Floating dropdown state (from scratch, AppSidebar pattern) ── */
	let filterMenuOpen = $state(false);
	let filterMenuPos = $state({ x: 0, y: 0 });
	let sortMenuOpen = $state(false);
	let sortMenuPos = $state({ x: 0, y: 0 });
	let selectMenuOpen = $state(false);
	let selectMenuPos = $state({ x: 0, y: 0 });

	function closeMenus() {
		filterMenuOpen = false;
		sortMenuOpen = false;
		selectMenuOpen = false;
	}

	function positionMenu(e: MouseEvent, width: number) {
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		return { x: rect.right - width, y: rect.bottom + 4 };
	}

	function toggleFilterMenu(e: MouseEvent) {
		if (filterMenuOpen) {
			filterMenuOpen = false;
			return;
		}
		closeMenus();
		filterMenuPos = positionMenu(e, 208);
		filterMenuOpen = true;
	}

	function toggleSortMenu(e: MouseEvent) {
		if (sortMenuOpen) {
			sortMenuOpen = false;
			return;
		}
		closeMenus();
		sortMenuPos = positionMenu(e, 176);
		sortMenuOpen = true;
	}

	function toggleSelectMenu(e: MouseEvent) {
		if (selectMenuOpen) {
			selectMenuOpen = false;
			return;
		}
		closeMenus();
		selectMenuPos = positionMenu(e, 240);
		selectMenuOpen = true;
	}

	function toggleFilter(kind: 'pdf' | 'docx' | 'txt') {
		if (kind === 'pdf') filterPdf = !filterPdf;
		else if (kind === 'docx') filterDocx = !filterDocx;
		else filterTxt = !filterTxt;
	}

	function keepDocumentsAtBottom() {
		requestAnimationFrame(() => {
			const activeScrollContainer = Array.from(
				document.querySelectorAll<HTMLElement>('[data-documents-scroll]')
			).find((element) => element.clientHeight > 0);

			activeScrollContainer?.scrollTo({
				top: activeScrollContainer.scrollHeight,
				behavior: 'auto'
			});
		});
	}
</script>

{#snippet mainList()}
	<Tooltip.Provider delayDuration={100}>
		<div
			data-documents-scroll
			class="flex h-full w-full flex-col gap-6 overflow-y-auto px-4 py-6 font-geist md:px-10 md:py-8"
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
			<div class="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-start">
				<div>
					<h1 class="text-3xl font-semibold text-white md:text-4xl">
						Document Library
					</h1>
					<p class="mt-1 max-w-3xl text-sm font-normal text-[#767676] md:text-base">
						Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
					</p>
				</div>

				<div class="flex items-center gap-2">
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<Button
									{...props}
									variant="ghost"
									type="button"
									disabled={isRefreshing}
									aria-label="Refresh document data"
									onclick={refreshPage}
									class="size-9 cursor-pointer rounded-full border border-white/[0.16] bg-transparent p-0 text-white transition-[background-color,border-color,color,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-px hover:border-white/[0.80] hover:bg-[#B8B5B5]/[0.40] hover:text-white disabled:cursor-wait disabled:opacity-60"
								>
									<RefreshCwIcon class="size-4 {isRefreshing ? 'animate-spin' : ''}" />
								</Button>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content
							class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
						>
							Refresh document data
						</Tooltip.Content>
					</Tooltip.Root>

					<Button
						class="group cursor-pointer rounded-full bg-[#DB8F5E] px-4 font-normal text-white transition-[background-color,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[#C47D4E] active:scale-[0.98]"
						onclick={() => (uploadDialogOpen = true)}
					>
						<PlusIcon
							data-icon="inline-start"
							class="transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:rotate-90"
						/>
						Add New
					</Button>
				</div>
			</div>

			<!-- Usage Summary -->
			<div class="grid gap-3 sm:grid-cols-3">
				<div class="rounded-2xl border border-[#302F2F] bg-[#191919]/[0.53] p-4">
					<div class="flex items-center gap-2 text-xs font-medium text-[#959595]">
						<FilesIcon class="size-4 text-white/60" />
						<span>Total Documents</span>
					</div>
					<p class="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">
						{totalDocumentCount}
					</p>
				</div>

				<div class="rounded-2xl border border-[#302F2F] bg-[#191919]/[0.53] p-4">
					<div class="flex items-center gap-2 text-xs font-medium text-[#959595]">
						<ArrowUpIcon class="size-4 text-white/60" />
						<span>Max Upload</span>
					</div>
					<p class="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">
						{uploadUsageDisplay}
					</p>
					<p class="mt-1 text-xs text-white/40">Reset in {uploadResetCountdown}</p>
				</div>

				<div class="rounded-2xl border border-[#302F2F] bg-[#191919]/[0.53] p-4">
					<div class="flex items-center gap-2 text-xs font-medium text-[#959595]">
						<HardDriveIcon class="size-4 text-white/60" />
						<span>Total Storage</span>
					</div>
					<p class="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">
						{storageUsageDisplay}
					</p>
					<div class="mt-3 flex items-center gap-2">
						<div
							class="relative h-2.5 flex-1 overflow-hidden rounded-full border border-white/15 bg-white/[0.06]"
							role="progressbar"
							aria-label="Storage usage"
							aria-valuemin="0"
							aria-valuemax="100"
							aria-valuenow={storageUsagePercent}
						>
							<div
								class="h-full rounded-full transition-[width,background-color] duration-700 {storageNearLimit
									? 'bg-red-500'
									: 'bg-white/60'}"
								style:width={`${storageUsagePercent}%`}
							></div>
						</div>
						<span class="w-9 text-right text-[11px] text-white/50 tabular-nums"
							>{storageUsagePercent}%</span
						>
					</div>
				</div>
			</div>

			<!-- Row 4: Data Table Controls -->
			<div class="flex flex-wrap items-center gap-2 md:gap-3">
				<!-- Search Input with Integrated Toggle -->
				<div class="relative min-w-0 flex-1 basis-full md:basis-0">
					<!-- Toggle Group positioned absolutely inside the input on the left -->
					<div class="absolute top-1/2 left-1.5 z-10 flex -translate-y-1/2 items-center">
						<ToggleGroup.Root
							type="single"
							bind:value={searchMode}
							class="flex h-7 items-center rounded-full bg-white/[0.03] p-0"
						>
							<ToggleGroup.Item
								value="keyword"
								aria-label="Toggle keyword search"
								class="flex h-7 w-7 cursor-pointer items-center justify-center !rounded-l-full text-white/50 transition-[background-color,color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white/[0.05] hover:text-white/70 data-[state=on]:bg-white/[0.10] data-[state=on]:text-white"
							>
								<Tooltip.Root>
									<Tooltip.Trigger>
										{#snippet child({ props })}
											<div {...props} class="flex h-full w-full items-center justify-center">
												<MxIcon name="receipt-search-outline" class="size-3.5" />
											</div>
										{/snippet}
									</Tooltip.Trigger>
									<Tooltip.Content
										class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
									>
										Keyword Search
									</Tooltip.Content>
								</Tooltip.Root>
							</ToggleGroup.Item>
							<ToggleGroup.Item
								value="semantic"
								aria-label="Toggle semantic search"
								class="flex h-7 w-7 cursor-pointer items-center justify-center !rounded-r-full text-white/50 transition-[background-color,color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white/[0.05] hover:text-white/70 data-[state=on]:bg-white/[0.10] data-[state=on]:text-white"
							>
								<Tooltip.Root>
									<Tooltip.Trigger>
										{#snippet child({ props })}
											<div {...props} class="flex h-full w-full items-center justify-center">
												<BookOpenIcon class="size-3.5" />
											</div>
										{/snippet}
									</Tooltip.Trigger>
									<Tooltip.Content
										class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
									>
										AI Hybrid Search
									</Tooltip.Content>
								</Tooltip.Root>
							</ToggleGroup.Item>
						</ToggleGroup.Root>
					</div>

					<Input
						placeholder={searchMode === 'keyword'
							? 'Search by title or description...'
							: 'Ask AI about your documents (Press Enter)...'}
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
						class="h-9 rounded-full border border-white/[0.16] bg-transparent pr-10 pl-[82px] font-normal text-white transition-[border-color,box-shadow] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] placeholder:text-white/40 focus-visible:border-white/35 focus-visible:ring-white/20"
					/>

					<!-- Loading Spinner or Clear Button on the right -->
					<div class="absolute top-1/2 right-3 z-10 flex -translate-y-1/2 items-center gap-1.5">
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
								class="flex size-5 cursor-pointer items-center justify-center rounded-full text-white/50 transition-[background-color,color,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-px hover:bg-white/10 hover:text-white"
								aria-label="Clear search"
							>
								<XIcon class="size-3.5" />
							</button>
						{/if}
					</div>
				</div>

				<!-- Filter Button -->
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								variant="ghost"
								disabled={searchMode === 'semantic'}
								class="size-9 cursor-pointer rounded-full border border-white/[0.16] bg-transparent p-0 font-normal text-white transition-[background-color,border-color,color,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-px hover:border-white/[0.80] hover:bg-[#B8B5B5]/[0.40] hover:text-white disabled:opacity-50 aria-expanded:border-white/[0.80] aria-expanded:bg-[#B8B5B5]/[0.40] aria-expanded:text-white"
								onclick={toggleFilterMenu}
								aria-haspopup="menu"
								aria-expanded={filterMenuOpen}
							>
								<MxIcon name="filter-outline" class="size-4" />
							</Button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content
						class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
					>
						<p>Filter Documents</p>
					</Tooltip.Content>
				</Tooltip.Root>

				{#if filterMenuOpen}
					<div
						role="presentation"
						class="fixed inset-0 z-50 bg-transparent"
						onclick={closeMenus}
						onkeydown={closeMenus}
					></div>
					<div
						transition:scale={{ duration: 150, start: 0.95 }}
						style={`position: fixed; top: ${filterMenuPos.y}px; left: ${filterMenuPos.x}px;`}
						class="z-50 w-52 rounded-xl border border-white/15 bg-[#232323]/95 p-1 text-white shadow-2xl backdrop-blur-2xl"
					>
						<button
							type="button"
							class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white"
							onclick={() => toggleFilter('pdf')}
						>
							<FileTextIcon class="size-3.5 text-white/60" />
							<span>PDF Documents</span>
							{#if filterPdf}
								<CheckIcon class="ml-auto size-3.5 text-white/60" />
							{/if}
						</button>
						<button
							type="button"
							class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white"
							onclick={() => toggleFilter('docx')}
						>
							<FilesIcon class="size-3.5 text-white/60" />
							<span>Word Documents (.docx)</span>
							{#if filterDocx}
								<CheckIcon class="ml-auto size-3.5 text-white/60" />
							{/if}
						</button>
						<button
							type="button"
							class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white"
							onclick={() => toggleFilter('txt')}
						>
							<FileStackIcon class="size-3.5 text-white/60" />
							<span>Text Files (.txt)</span>
							{#if filterTxt}
								<CheckIcon class="ml-auto size-3.5 text-white/60" />
							{/if}
						</button>
					</div>
				{/if}

				<!-- Sort Button -->
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								variant="ghost"
								disabled={searchMode === 'semantic'}
								class="size-9 cursor-pointer rounded-full border border-white/[0.16] bg-transparent p-0 font-normal text-white transition-[background-color,border-color,color,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-px hover:border-white/[0.80] hover:bg-[#B8B5B5]/[0.40] hover:text-white disabled:opacity-50 aria-expanded:border-white/[0.80] aria-expanded:bg-[#B8B5B5]/[0.40] aria-expanded:text-white"
								onclick={toggleSortMenu}
								aria-haspopup="menu"
								aria-expanded={sortMenuOpen}
							>
								<MxIcon name="sort-outline" class="size-4" />
							</Button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content
						class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
					>
						<p>Sort Documents</p>
					</Tooltip.Content>
				</Tooltip.Root>

				{#if sortMenuOpen}
					<div
						role="presentation"
						class="fixed inset-0 z-50 bg-transparent"
						onclick={closeMenus}
						onkeydown={closeMenus}
					></div>
					<div
						transition:scale={{ duration: 150, start: 0.95 }}
						style={`position: fixed; top: ${sortMenuPos.y}px; left: ${sortMenuPos.x}px;`}
						class="z-50 w-44 rounded-xl border border-white/15 bg-[#232323]/95 p-1 text-white shadow-2xl backdrop-blur-2xl"
					>
						<button
							type="button"
							class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white"
							onclick={() => handleSort('name')}
						>
							<ArrowDownAZIcon class="size-3.5 text-white/60" />
							<span>Alphabet</span>
							{#if table.getColumn('name')?.getIsSorted() === 'asc'}
								<ArrowUpIcon class="ml-auto size-3.5 text-white/60" />
							{:else if table.getColumn('name')?.getIsSorted() === 'desc'}
								<ArrowDownIcon class="ml-auto size-3.5 text-white/60" />
							{/if}
						</button>
						<button
							type="button"
							class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white"
							onclick={() => handleSort('uploadedAt')}
						>
							<CalendarDaysIcon class="size-3.5 text-white/60" />
							<span>Date Uploaded</span>
							{#if table.getColumn('uploadedAt')?.getIsSorted() === 'asc'}
								<ArrowUpIcon class="ml-auto size-3.5 text-white/60" />
							{:else if table.getColumn('uploadedAt')?.getIsSorted() === 'desc'}
								<ArrowDownIcon class="ml-auto size-3.5 text-white/60" />
							{/if}
						</button>
						<button
							type="button"
							class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white"
							onclick={() => handleSort('size')}
						>
							<HardDriveIcon class="size-3.5 text-white/60" />
							<span>Size</span>
							{#if table.getColumn('size')?.getIsSorted() === 'asc'}
								<ArrowUpIcon class="ml-auto size-3.5 text-white/60" />
							{:else if table.getColumn('size')?.getIsSorted() === 'desc'}
								<ArrowDownIcon class="ml-auto size-3.5 text-white/60" />
							{/if}
						</button>
					</div>
				{/if}

				<!-- Select Button & Dropdown -->
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								variant="ghost"
								class="h-9 cursor-pointer rounded-full border border-white/[0.16] bg-transparent font-normal text-white transition-[background-color,border-color,color,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-px hover:border-white/[0.80] hover:bg-[#B8B5B5]/[0.40] hover:text-white aria-expanded:border-white/[0.80] aria-expanded:bg-[#B8B5B5]/[0.40] aria-expanded:text-white {selectedCount >
								0
									? 'border-white/[0.80] bg-[#B8B5B5]/[0.40] px-2.5'
									: 'flex w-9 items-center justify-center p-0'}"
								onclick={toggleSelectMenu}
								aria-haspopup="menu"
								aria-expanded={selectMenuOpen}
							>
								<CheckSquareIcon class="size-4" />
								{#if selectedCount > 0}
									<span class="ml-1.5 text-xs font-semibold">{selectedCount}</span>
								{/if}
							</Button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content
						class="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
					>
						<p>
							{selectedCount > 0 ? `Selected Documents (${selectedCount})` : 'Select Documents'}
						</p>
					</Tooltip.Content>
				</Tooltip.Root>

				{#if selectMenuOpen}
					<div
						role="presentation"
						class="fixed inset-0 z-50 bg-transparent"
						onclick={closeMenus}
						onkeydown={closeMenus}
					></div>
					<div
						transition:scale={{ duration: 150, start: 0.95 }}
						style={`position: fixed; top: ${selectMenuPos.y}px; left: ${selectMenuPos.x}px;`}
						class="z-50 w-60 rounded-xl border border-white/15 bg-[#232323]/95 p-1 text-white shadow-2xl backdrop-blur-2xl"
					>
						<button
							type="button"
							class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white"
							onclick={() => {
								selectAllPageDocuments();
								closeMenus();
							}}
						>
							<ListChecksIcon class="size-3.5 text-white/60" />
							<span>Select page ({table.getRowModel().rows.length})</span>
						</button>
						<button
							type="button"
							class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white"
							onclick={() => {
								selectAllTotalDocuments();
								closeMenus();
							}}
						>
							<ListIcon class="size-3.5 text-white/60" />
							<span>Select all ({documentsList.length})</span>
						</button>
						{#if selectedCount > 0}
							<button
								type="button"
								class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white"
								onclick={() => {
									clearSelection();
									closeMenus();
								}}
							>
								<ListXIcon class="size-3.5 text-white/60" />
								<span>Deselect all ({selectedCount})</span>
							</button>
							<div class="my-1 h-px bg-white/10"></div>
							<button
								type="button"
								class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
								disabled={isBatchDownloading}
								onclick={() => {
									closeMenus();
									handleBatchDownload();
								}}
							>
								{#if isBatchDownloading}
									<Loader2Icon class="size-3.5 animate-spin text-white/60" />
								{:else}
									<MxIcon name="arrows-action-import-outline" class="size-3.5 text-white/60" />
								{/if}
								<span>Download selected ({selectedCount})</span>
							</button>
							<button
								type="button"
								class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 focus:bg-red-500/10 focus:text-red-300 focus:outline-none active:bg-red-500/15"
								onclick={() => {
									closeMenus();
									showBatchDeleteModal = true;
								}}
							>
								<MxIcon
									name="trash-bin-minimalistic-outline"
									class="size-3.5 shrink-0 text-red-400"
								/>
								<span>Delete selected ({selectedCount})</span>
							</button>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Row 5: Card List -->
			<div class="flex flex-col gap-3">
				{#if isSemanticSearching}
					<!-- Hybrid search skeleton: mirrors the document card -->
					{#each [0, 1, 2] as _skeleton (_skeleton)}
						<div
							class="flex animate-pulse flex-col gap-3 rounded-2xl border border-[#302F2F] bg-[#191919]/[0.53] p-4 md:p-5"
							aria-hidden="true"
						>
							<!-- Header -->
							<div class="flex items-start justify-between gap-3">
								<div class="flex items-center gap-3">
									<div class="size-4.5 rounded-md bg-[#302F2F]"></div>
									<div class="h-3.5 w-44 rounded-full bg-[#302F2F]"></div>
								</div>
								<div class="flex items-center gap-3">
									<div class="h-5 w-20 rounded-full bg-[#DB8F5E]/15"></div>
									<div class="size-7 rounded-full bg-[#302F2F]"></div>
								</div>
							</div>
							<!-- Description -->
							<div class="flex flex-col gap-2">
								<div class="h-3 w-full rounded-full bg-[#302F2F]"></div>
								<div class="h-3 w-2/3 rounded-full bg-[#302F2F]"></div>
							</div>
							<!-- "Why this matched" box -->
							<div class="rounded-lg border border-[#DB8F5E]/20 bg-[#1A1512] p-3.5">
								<div class="flex items-center gap-1.5">
									<div class="h-3 w-24 rounded-full bg-[#DB8F5E]/20"></div>
								</div>
								<div class="mt-2.5 flex flex-col gap-1.5">
									<div class="h-3 w-full rounded-full bg-white/10"></div>
									<div class="h-3 w-3/4 rounded-full bg-white/10"></div>
								</div>
							</div>
							<!-- Meta -->
							<div class="h-3 w-48 rounded-full bg-[#302F2F]"></div>
						</div>
					{/each}
				{:else}
					{#each table.getRowModel().rows as row (row.id)}
						{@const doc = row.original as Document}
						{@const isSelected = selectedDocIds.includes(doc.id)}
						<div
							role="button"
							tabindex="0"
							onclick={() => toggleSelectDoc(doc.id)}
							onkeydown={(e) => e.key === 'Enter' && toggleSelectDoc(doc.id)}
							class="group relative cursor-pointer overflow-hidden rounded-2xl border p-4 transition-[background-color,border-color,transform] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-px md:p-5 {isSelected
								? 'selected-card-glass border-white/45 bg-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] ring-1 ring-white/10'
								: 'border-[#302F2F] bg-[#191919]/[0.53] hover:border-[#949494] hover:bg-[#525252]/[0.53]'} {deselectedCardIds.includes(
								doc.id
							)
								? 'deselected-card-glass'
								: ''}"
						>
							<!-- Card Row 1: Header -->
							<div class="flex items-start justify-between gap-3">
								<div class="flex items-center gap-3">
									<MxIcon name="document-outline" class="size-4.5 shrink-0 text-[#C5937B]" />
									<span class="text-sm font-medium text-white md:text-base"
										>{@html highlightMatch(doc.name, activeSearchQuery)}</span
									>
								</div>
								<div
									class="flex items-center gap-3"
									onclick={(e) => e.stopPropagation()}
									role="none"
								>
									{#if doc.score !== undefined}
										{@const score = doc.score}
										<Tooltip.Root>
											<Tooltip.Trigger>
												{#snippet child({ props })}
													<div
														{...props}
														class="match-score"
														aria-label={`${(score * 100).toFixed(2)} percent match`}
													>
														<span class="match-score-dot" aria-hidden="true"></span>
														<span class="font-mono tabular-nums">{(score * 100).toFixed(2)}%</span>
														<span class="match-score-label">match</span>
													</div>
												{/snippet}
											</Tooltip.Trigger>
											<Tooltip.Content
												class="rounded-lg border border-white/10 bg-[#202020] px-2.5 py-1.5 text-xs font-medium text-white shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
											>
												<p>How well this document matches your question</p>
											</Tooltip.Content>
										</Tooltip.Root>
									{/if}
									<DocumentCardActions
										id={doc.id}
										previewDisabled={isVectorizing(doc) && !isPdfDocument(doc)}
										onPreview={() => handlePreview(doc)}
										onDownload={() => handleDownload(doc)}
										onRename={() => promptRename(doc)}
										onDelete={() => promptDelete(doc)}
									/>
								</div>
							</div>

							<!-- Card Row 2: Description -->
							{#if (doc.status === 'pending' || doc.status === 'confirmed') && (!doc.description || doc.description === 'No description provided.')}
								<div
									class="mt-2 flex animate-pulse items-center gap-2 text-sm font-normal text-white/50 italic"
								>
									<SparklesIcon class="size-3.5 shrink-0 text-white/70" />
									<span>Generating summary with AI...</span>
								</div>
							{:else if doc.status === 'quota_exhausted' && (!doc.description || doc.description === 'No description provided.')}
								<div
									class="mt-2 flex items-center gap-2 text-sm font-normal text-amber-400/70 italic"
								>
									<MxIcon name="clock-outline" class="size-3.5 shrink-0 text-amber-400" />
									<span>Summary generation paused due to daily quota. Resuming tomorrow.</span>
								</div>
							{:else}
								<p
									class="mt-2 text-sm font-normal text-white/80 {activeSearchQuery.trim()
										? ''
										: 'line-clamp-2'}"
								>
									{@html highlightMatch(doc.description, activeSearchQuery)}
								</p>
							{/if}

							{#if doc.semanticContent}
								<div class="semantic-match-panel">
									<button
										type="button"
										class="semantic-match-trigger"
										onclick={(e) => {
											e.stopPropagation();
											if (expandedDocs.includes(doc.id)) {
												expandedDocs = expandedDocs.filter((id) => id !== doc.id);
											} else {
												expandedDocs = [...expandedDocs, doc.id];
											}
										}}
										aria-expanded={expandedDocs.includes(doc.id)}
										aria-controls={`semantic-match-${doc.id}`}
									>
										<span class="flex min-w-0 items-center gap-2.5">
											<span class="min-w-0 text-left">
												<span
													class="block text-[13px] font-medium tracking-[-0.01em] text-white/90"
												>
													Why this matched
												</span>
												<span
													class="mt-0.5 block text-[10px] tracking-[0.12em] text-white/35 uppercase"
												>
													Semantic context
												</span>
											</span>
										</span>
										<span class="semantic-match-action">
											<span>{expandedDocs.includes(doc.id) ? 'Show less' : 'Read more'}</span>
											<ChevronDownIcon
												class="size-3.5 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] {expandedDocs.includes(
													doc.id
												)
													? 'rotate-180'
													: ''}"
												strokeWidth={1.8}
											/>
										</span>
									</button>

									<div
										id={`semantic-match-${doc.id}`}
										class="semantic-match-copy {expandedDocs.includes(doc.id)
											? 'semantic-match-copy-expanded'
											: 'semantic-match-copy-collapsed'}"
									>
										{@html highlightMatch(doc.semanticContent, activeSearchQuery)}
									</div>
								</div>
							{/if}

							<!-- Card Row 3: Metadata & Real-time Status Badge -->
							<div class="mt-2.5 flex items-center justify-between gap-2">
								<div class="flex items-center gap-2.5">
									<p class="text-xs font-normal text-[#959595]">
										Uploaded {doc.uploadedAt} · {doc.size}
									</p>

									{#if doc.pages && doc.pages.length > 0}
										{@const pages = doc.pages}
										<Tooltip.Root>
											<Tooltip.Trigger>
												{#snippet child({ props })}
													<div {...props} class="page-reference">
														<BookOpenIcon class="size-3.5 text-[#DB8F5E]" strokeWidth={1.7} />
														<span
															>Page{pages.length > 1 ? 's' : ''}
															{pages.slice(0, 3).join(', ')}{pages.length > 3 ? '…' : ''}</span
														>
													</div>
												{/snippet}
											</Tooltip.Trigger>
											<Tooltip.Content
												class="rounded-lg border border-white/10 bg-[#202020] px-2.5 py-1.5 text-xs font-medium text-white shadow-[0_12px_30px_rgba(0,0,0,0.18)]"
											>
												<p>Found on page{pages.length > 1 ? 's' : ''}: {pages.join(', ')}</p>
											</Tooltip.Content>
										</Tooltip.Root>
									{/if}
								</div>

								<!-- Vectorizing / Quota / Failed Status Badge -->
								{#if doc.status === 'pending' || doc.status === 'confirmed'}
									<div
										class="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white/90 transition-[background-color,border-color,transform] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-px group-hover:border-white/30 group-hover:bg-white/20"
									>
										<SparklesIcon class="size-3.5 animate-pulse text-white" />
										<span class="tracking-wide">Preparing…</span>
									</div>
								{:else if doc.status === 'quota_exhausted'}
									<Tooltip.Root>
										<Tooltip.Trigger>
											{#snippet child({ props })}
												<div
													{...props}
													class="inline-flex cursor-help items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-950/40 px-2.5 py-0.5 text-xs font-medium text-amber-300"
												>
													<MxIcon name="clock-outline" class="size-3.5 text-amber-400" />
													<span class="font-medium tracking-wide">Resuming Tomorrow</span>
												</div>
											{/snippet}
										</Tooltip.Trigger>
										<Tooltip.Content
											class="max-w-xs rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black shadow-md"
										>
											<p>Daily AI quota reached. Vectorizing will resume tomorrow at 00:00 UTC.</p>
										</Tooltip.Content>
									</Tooltip.Root>
								{:else if doc.status === 'failed_vectorizing'}
									<div
										class="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-950/40 px-2.5 py-0.5 text-xs font-medium text-red-400"
									>
										<XIcon class="size-3.5 text-red-400" />
										<span class="font-medium tracking-wide">Failed Vectorizing</span>
									</div>
								{:else if doc.status === 'failed'}
									<div
										class="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-950/40 px-2.5 py-0.5 text-xs font-medium text-red-400"
									>
										<XIcon class="size-3.5 text-red-400" />
										<span class="font-medium tracking-wide">Processing Failed</span>
									</div>
								{/if}
							</div>
						</div>
					{:else}
						<div
							class="flex h-32 items-center justify-center rounded-2xl border border-[#302F2F] bg-[#191919]/[0.53]"
						>
							<p class="text-sm text-[#959595]">No documents found.</p>
						</div>
					{/each}
				{/if}
			</div>

			<!-- Bottom: Pagination -->
			{#if totalFilteredRows > 0}
				<div class="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
					<p class="px-1 text-xs text-[#767676]">
						{paginationRange.start}–{paginationRange.end} of {totalFilteredRows}
						{totalFilteredRows === 1 ? 'document' : 'documents'}
					</p>

					{#if totalFilteredRows > 10}
						<div class="flex items-center justify-end gap-2">
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
												onclick={keepDocumentsAtBottom}
												class="cursor-pointer rounded-full text-white transition-[background-color,color,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-px hover:bg-white/10 hover:text-white disabled:text-white/20"
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
														onclick={keepDocumentsAtBottom}
														class="cursor-pointer rounded-full text-white/75 transition-[background-color,border-color,color,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-px hover:bg-white/10 hover:text-white data-[active=true]:border-white/45 data-[active=true]:bg-white/10 data-[active=true]:text-white"
													>
														{page.value}
													</Pagination.Link>
												</Pagination.Item>
											{/if}
										{/each}

										<Pagination.Item>
											<Pagination.Next
												onclick={keepDocumentsAtBottom}
												class="cursor-pointer rounded-full text-white transition-[background-color,color,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-px hover:bg-white/10 hover:text-white disabled:text-white/20"
											/>
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
{/snippet}

<div class="absolute inset-0 h-full w-full">
	<div class="h-full w-full md:hidden">
		<div class="h-full w-full" class:hidden={previewDocument !== null}>
			{@render mainList()}
		</div>
		{#if previewDocument}
			<div class="h-full w-full">
				<PdfPreviewPanel
					src={previewDocument.url ?? ''}
					name={previewDocument.name}
					initialPages={previewDocument.pages ?? []}
					onclose={() => (previewDocument = null)}
				/>
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
					<PdfPreviewPanel
						src={previewDocument.url ?? ''}
						name={previewDocument.name}
						initialPages={previewDocument.pages ?? []}
						onclose={() => (previewDocument = null)}
					/>
				</Resizable.Pane>
			</Resizable.PaneGroup>
		{:else}
			{@render mainList()}
		{/if}
	</div>
</div>

<UploadDocumentDialog bind:open={uploadDialogOpen} onSuccess={refreshPage} />

<!-- Delete Confirmation Dialog -->
<ConfirmDeleteDialog
	bind:open={deleteDialogOpen}
	title="Delete"
	itemName={documentToDelete?.name}
	description="This action cannot be undone."
	{isDeleting}
	confirmLabel="Delete"
	onConfirm={confirmDelete}
	onClose={() => (deleteDialogOpen = false)}
/>

<!-- Rename Document Dialog -->
<Dialog.Root bind:open={renameDialogOpen}>
	<Dialog.Content
		class="border-[#302F2F] bg-[#191919]/[0.85] text-white backdrop-blur-[42px] sm:max-w-md sm:rounded-[22px]"
	>
		<Dialog.Header class="gap-2">
			<Dialog.Title class="text-xl font-semibold text-white">Rename Document</Dialog.Title>
			<Dialog.Description class="text-sm text-[#767676]">
				{#if documentToRename}
					Current title: <span class="break-all text-white/80">{documentToRename.name}</span>
					<br />The file extension is fixed — only the name part can be edited.
				{/if}
			</Dialog.Description>
		</Dialog.Header>

		<div class="mt-4">
			<div class="flex items-stretch gap-2">
				<Input
					value={renameBaseValue}
					oninput={(e) => (renameBaseValue = e.currentTarget.value)}
					onkeydown={(e) => {
						if (e.key === 'Enter' && !isRenaming) confirmRename();
					}}
					placeholder="New document title"
					maxlength={255}
					class="h-10 rounded-lg border border-white/[0.16] bg-transparent font-normal text-white transition-[border-color,box-shadow] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] placeholder:text-white/40 focus-visible:border-white/35 focus-visible:ring-white/20"
				/>
				{#if documentToRename}
					<span
						class="inline-flex shrink-0 items-center rounded-lg border border-white/[0.16] bg-white/[0.06] px-2.5 text-sm text-white/60 select-none"
					>
						{getDocumentExtension(documentToRename.name)}
					</span>
				{/if}
			</div>
			{#if renameError}
				<p class="mt-2 text-xs text-red-400">{renameError}</p>
			{/if}
		</div>

		<Dialog.Footer class="mt-4 flex flex-row justify-end gap-3">
			<Button
				type="button"
				variant="ghost"
				onclick={() => (renameDialogOpen = false)}
				disabled={isRenaming}
				class="cursor-pointer text-sm text-white hover:bg-white/10"
			>
				Cancel
			</Button>
			<Button
				type="button"
				onclick={confirmRename}
				disabled={isRenaming}
				class="cursor-pointer bg-[#DB8F5E] text-white hover:bg-[#C47D4E] disabled:opacity-50"
			>
				{#if isRenaming}
					<Loader2Icon class="mr-2 size-4 animate-spin" />
					Saving...
				{:else}
					Save
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Batch Delete Confirmation Modal -->
<Dialog.Root bind:open={showBatchDeleteModal}>
	<Dialog.Content
		class="border-[#302F2F] bg-[#191919]/[0.85] text-white backdrop-blur-[42px] sm:max-w-md sm:rounded-[22px]"
	>
		<Dialog.Header class="gap-2">
			<Dialog.Title class="text-xl font-semibold text-white">
				Delete {selectedCount}
				{selectedCount === 1 ? 'Document' : 'Documents'}?
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

<style>
	.match-highlight {
		background: rgb(217 142 104 / 0.28);
		border-radius: 3px;
		padding: 0 2px;
		color: #f4e6d4;
		box-decoration-break: clone;
		-webkit-box-decoration-break: clone;
	}

	.semantic-match-panel {
		position: relative;
		margin-top: 0.875rem;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 0.75rem;
		background: linear-gradient(
			135deg,
			rgba(255, 255, 255, 0.075) 0%,
			rgba(30, 30, 30, 0.84) 54%,
			rgba(219, 143, 94, 0.07) 100%
		);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
		transition:
			border-color 600ms cubic-bezier(0.32, 0.72, 0, 1),
			transform 600ms cubic-bezier(0.32, 0.72, 0, 1);
	}

	.semantic-match-panel:hover {
		border-color: rgba(219, 143, 94, 0.34);
		transform: translateY(-1px);
	}

	.semantic-match-trigger {
		position: relative;
		display: flex;
		width: 100%;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.8rem 0.9rem 0.75rem 1rem;
		text-align: left;
		transition: background-color 500ms cubic-bezier(0.32, 0.72, 0, 1);
	}

	.semantic-match-trigger:hover {
		background: rgba(255, 255, 255, 0.045);
	}

	.semantic-match-trigger:focus-visible {
		outline: none;
		box-shadow: inset 0 0 0 1px rgba(219, 143, 94, 0.72);
	}

	.semantic-match-action {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		gap: 0.3rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.045);
		padding: 0.35rem 0.55rem 0.35rem 0.7rem;
		font-size: 0.6875rem;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.62);
		white-space: nowrap;
		transition:
			background-color 500ms cubic-bezier(0.32, 0.72, 0, 1),
			border-color 500ms cubic-bezier(0.32, 0.72, 0, 1),
			color 500ms cubic-bezier(0.32, 0.72, 0, 1),
			transform 500ms cubic-bezier(0.32, 0.72, 0, 1);
	}

	.semantic-match-trigger:hover .semantic-match-action {
		border-color: rgba(219, 143, 94, 0.42);
		background: rgba(219, 143, 94, 0.12);
		color: #db8f5e;
		transform: translateX(1px);
	}

	.semantic-match-copy {
		border-top: 1px solid rgba(255, 255, 255, 0.08);
		padding: 0.8rem 1rem 1rem 1rem;
		font-size: 0.8125rem;
		font-weight: 400;
		line-height: 1.65;
		color: rgba(255, 255, 255, 0.72);
		transition:
			opacity 500ms cubic-bezier(0.32, 0.72, 0, 1),
			transform 500ms cubic-bezier(0.32, 0.72, 0, 1);
	}

	.semantic-match-copy-collapsed {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 4;
		line-clamp: 4;
		overflow: hidden;
		max-height: calc(1.65em * 4);
		-webkit-mask-image: linear-gradient(to bottom, #000 0, #000 4.5em, rgba(0, 0, 0, 0.3) 6.6em);
		mask-image: linear-gradient(to bottom, #000 0, #000 4.5em, rgba(0, 0, 0, 0.3) 6.6em);
	}

	.semantic-match-copy-expanded {
		color: rgba(255, 255, 255, 0.8);
		max-height: none;
		-webkit-line-clamp: unset;
		line-clamp: unset;
		-webkit-mask-image: none;
		mask-image: none;
	}

	.match-score {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border: 1px solid rgba(219, 143, 94, 0.34);
		border-radius: 999px;
		background: rgba(219, 143, 94, 0.1);
		padding: 0.3rem 0.55rem;
		font-size: 0.6875rem;
		font-weight: 600;
		color: #db8f5e;
		white-space: nowrap;
		transition:
			background-color 500ms cubic-bezier(0.32, 0.72, 0, 1),
			border-color 500ms cubic-bezier(0.32, 0.72, 0, 1),
			transform 500ms cubic-bezier(0.32, 0.72, 0, 1);
	}

	.match-score:hover {
		border-color: rgba(219, 143, 94, 0.62);
		background: rgba(219, 143, 94, 0.16);
		transform: translateY(-1px);
	}

	.match-score-dot {
		height: 0.35rem;
		width: 0.35rem;
		border-radius: 999px;
		background: #db8f5e;
	}

	.match-score-label {
		font-size: 0.625rem;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(244, 230, 212, 0.62);
	}

	.page-reference {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.045);
		padding: 0.3rem 0.65rem;
		font-size: 0.6875rem;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.62);
		white-space: nowrap;
		transition:
			background-color 500ms cubic-bezier(0.32, 0.72, 0, 1),
			border-color 500ms cubic-bezier(0.32, 0.72, 0, 1),
			color 500ms cubic-bezier(0.32, 0.72, 0, 1),
			transform 500ms cubic-bezier(0.32, 0.72, 0, 1);
	}

	.page-reference:hover {
		border-color: rgba(219, 143, 94, 0.42);
		background: rgba(219, 143, 94, 0.09);
		color: rgba(255, 255, 255, 0.86);
		transform: translateY(-1px);
	}

	@media (max-width: 767px) {
		.semantic-match-copy {
			padding-left: 1rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.semantic-match-panel,
		.semantic-match-trigger,
		.semantic-match-action,
		.semantic-match-copy,
		.match-score,
		.page-reference {
			transition: none;
		}
	}

	.selected-card-glass {
		animation: document-card-select 700ms cubic-bezier(0.32, 0.72, 0, 1) both;
	}

	.selected-card-glass::after {
		position: absolute;
		inset: 0;
		pointer-events: none;
		content: '';
		border-radius: inherit;
		background: linear-gradient(
			105deg,
			transparent 24%,
			rgb(255 255 255 / 0.16) 48%,
			transparent 70%
		);
		transform: translateX(-120%);
		opacity: 0;
		animation: document-card-sheen 900ms cubic-bezier(0.32, 0.72, 0, 1) both;
	}

	.deselected-card-glass {
		animation: document-card-deselect 700ms cubic-bezier(0.32, 0.72, 0, 1) both;
	}

	.deselected-card-glass::after {
		position: absolute;
		inset: 0;
		pointer-events: none;
		content: '';
		border-radius: inherit;
		background: linear-gradient(
			105deg,
			transparent 24%,
			rgb(255 255 255 / 0.16) 48%,
			transparent 70%
		);
		transform: translateX(120%);
		opacity: 0;
		animation: document-card-sheen-reverse 900ms cubic-bezier(0.32, 0.72, 0, 1) both;
	}

	@keyframes document-card-select {
		from {
			transform: scale(0.985);
			opacity: 0.82;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}

	@keyframes document-card-deselect {
		from {
			transform: scale(1);
			opacity: 1;
		}
		to {
			transform: scale(0.985);
			opacity: 0.82;
		}
	}

	@keyframes document-card-sheen {
		0% {
			transform: translateX(-120%);
			opacity: 0;
		}
		20% {
			opacity: 1;
		}
		100% {
			transform: translateX(120%);
			opacity: 0;
		}
	}

	@keyframes document-card-sheen-reverse {
		0% {
			transform: translateX(120%);
			opacity: 0;
		}
		20% {
			opacity: 1;
		}
		100% {
			transform: translateX(-120%);
			opacity: 0;
		}
	}
</style>
