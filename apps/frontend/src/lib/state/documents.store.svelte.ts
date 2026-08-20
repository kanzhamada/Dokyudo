import { getDocuments, type DocumentItem } from '$lib/api/documents';
import { supabase } from '$lib/supabase/client';

/** Revalidation window — mention list is refetched at most every 5 minutes. */
const TTL_MS = 5 * 60 * 1000;

function createDocumentsStore() {
	let documents = $state<DocumentItem[]>([]);
	let isLoading = $state(false);
	let hasError = $state(false);
	let loadedAt = $state<number | null>(null);
	let channelSubscribed = false;

	function initRealtime() {
		if (channelSubscribed || typeof window === 'undefined') return;
		channelSubscribed = true;

		supabase
			.channel('global:documents_store')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, (payload) => {
				console.log('[DocumentsStore Realtime] Change received:', payload.eventType, payload);

				if (payload.eventType === 'INSERT') {
					const inserted = payload.new as {
						id: string;
						title?: string;
						description?: string | null;
						storage_path?: string;
						size_bytes?: number;
						status?: string;
						created_at?: string;
					};
					if (inserted && inserted.id) {
						const exists = documents.some((d) => d.id === inserted.id);
						if (!exists) {
							documents = [
								...documents,
								{
									id: inserted.id,
									title: inserted.title || 'Untitled document',
									description: inserted.description || null,
									storagePath: inserted.storage_path || '',
									sizeBytes: inserted.size_bytes || 0,
									status: inserted.status || 'pending',
									createdAt: inserted.created_at || new Date().toISOString()
								}
							];
						}
						void ensureLoaded(true);
					}
				} else if (payload.eventType === 'UPDATE') {
					const updated = payload.new as {
						id: string;
						title?: string;
						description?: string | null;
						status?: string;
					};
					if (updated && updated.id) {
						const idx = documents.findIndex((d) => d.id === updated.id);
						if (idx !== -1) {
							documents[idx] = {
								...documents[idx],
								...(updated.title ? { title: updated.title } : {}),
								...(updated.description !== undefined ? { description: updated.description } : {}),
								...(updated.status ? { status: updated.status } : {})
							};
							documents = [...documents];
						} else {
							void ensureLoaded(true);
						}
					}
				} else if (payload.eventType === 'DELETE') {
					const oldDoc = payload.old as { id?: string };
					if (oldDoc?.id) {
						documents = documents.filter((d) => d.id !== oldDoc.id);
					}
				}
			})
			.subscribe();
	}

	/**
	 * Loads the tenant's documents and subscribes to realtime changes.
	 * Revalidates when the cached copy is older than TTL or when forced.
	 */
	async function ensureLoaded(force = false) {
		initRealtime();
		if (isLoading) return;
		if (!force && loadedAt !== null && Date.now() - loadedAt < TTL_MS) return;

		isLoading = true;
		hasError = false;
		try {
			const res = await getDocuments();
			if (res.ok) {
				documents = res.data.documents;
				loadedAt = Date.now();
			} else {
				hasError = true;
			}
		} catch {
			hasError = true;
		} finally {
			isLoading = false;
		}
	}

	/** Drops the cache and immediately fetches fresh documents in the background. */
	function invalidate() {
		loadedAt = null;
		void ensureLoaded(true);
	}

	function remove(documentId: string) {
		documents = documents.filter((d) => d.id !== documentId);
	}

	function addOrUpdate(doc: Partial<DocumentItem> & { id: string }) {
		const idx = documents.findIndex((d) => d.id === doc.id);
		if (idx !== -1) {
			documents[idx] = { ...documents[idx], ...doc };
			documents = [...documents];
		} else {
			documents = [
				...documents,
				{
					id: doc.id,
					title: doc.title || 'Untitled document',
					description: doc.description ?? null,
					storagePath: doc.storagePath || '',
					sizeBytes: doc.sizeBytes || 0,
					status: doc.status || 'pending',
					createdAt: doc.createdAt || new Date().toISOString()
				}
			];
		}
	}

	return {
		get list() {
			return documents;
		},
		get loading() {
			return isLoading;
		},
		get hasError() {
			return hasError;
		},
		ensureLoaded,
		invalidate,
		remove,
		addOrUpdate
	};
}

export const documentsStore = createDocumentsStore();
