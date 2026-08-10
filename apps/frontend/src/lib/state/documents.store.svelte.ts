import { getDocuments, type DocumentItem } from '$lib/api/documents';

/** Revalidation window — mention list is refetched at most every 5 minutes. */
const TTL_MS = 5 * 60 * 1000;

function createDocumentsStore() {
	let documents = $state<DocumentItem[]>([]);
	let isLoading = $state(false);
	let hasError = $state(false);
	let loadedAt = $state<number | null>(null);

	/**
	 * Loads the tenant's documents once per session and revalidates when the
	 * cached copy is older than TTL. Idempotent — both chat pages call it on
	 * mount, only the first call (or the first one after the TTL) hits the API.
	 */
	async function ensureLoaded(force = false) {
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

	/** Drops the cache — call after uploads/deletes so the next mention refetches. */
	function invalidate() {
		loadedAt = null;
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
		invalidate
	};
}

export const documentsStore = createDocumentsStore();
