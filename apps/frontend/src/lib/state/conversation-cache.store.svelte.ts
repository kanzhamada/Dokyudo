import { PUBLIC_API_URL } from '$env/static/public';
import { dokyudoFetch } from '$lib/apiClient';
import { sessionStore } from '$lib/state/session.store.svelte';
import type { ApiErrorResponse } from '$lib/types/api.types';
import type { GetConversationResponse } from '$lib/types/rag.types';

/**
 * Client-side LRU cache untuk detail conversation (`GET /api/rag/conversations/:id`).
 *
 * - Max 5 conversation (LRU) — navigasi antar /chat/[id] jadi instan.
 * - Stale-while-revalidate: halaman render dari cache dulu, refetch di background
 *   dengan ETag (304 = data tidak berubah, cache dipertahankan).
 * - Conversation yang masih `processing`/`awaiting_indexing` TIDAK pernah di-serve
 *   dari cache (selalu refetch) agar tidak terlihat "beku".
 * - `invalidate(id)` menghapus ETag sehingga revalidation berikutnya pasti 200.
 */
const MAX_ENTRIES = 5;
const STALE_MS = 30_000;

interface CacheEntry {
	data: GetConversationResponse;
	etag: string | null;
	fetchedAt: number;
	loading: boolean;
}

const entries = $state<Record<string, CacheEntry>>({});
const order: string[] = [];

function touch(id: string) {
	const idx = order.indexOf(id);
	if (idx !== -1) order.splice(idx, 1);
	order.push(id);
	while (order.length > MAX_ENTRIES) {
		const evicted = order.shift();
		if (evicted) delete entries[evicted];
	}
}

function isProcessing(data: GetConversationResponse): boolean {
	return data.turns.some((t) => t.status === 'processing' || t.status === 'awaiting_indexing');
}

function isStale(id: string): boolean {
	const entry = entries[id];
	return !entry || Date.now() - entry.fetchedAt > STALE_MS;
}

async function fetchEntry(id: string) {
	const headers = new Headers();
	const token = sessionStore.getAccessToken();
	if (token) headers.set('Authorization', `Bearer ${token}`);
	const entry = entries[id];
	if (entry?.etag) headers.set('If-None-Match', entry.etag);

	const response = await dokyudoFetch(`${PUBLIC_API_URL}/api/rag/conversations/${id}`, {
		method: 'GET',
		headers
	});

	if (response.status === 304) {
		if (entry) {
			entry.fetchedAt = Date.now();
			entry.loading = false;
			touch(id);
		}
		return {
			ok: true as const,
			data: entry?.data ?? null,
			notModified: true as const,
			error: undefined
		};
	}

	if (response.ok) {
		const data = (await response.json()) as GetConversationResponse;
		entries[id] = {
			data,
			etag: response.headers.get('etag'),
			fetchedAt: Date.now(),
			loading: false
		};
		touch(id);
		return { ok: true as const, data, notModified: false as const, error: undefined };
	}

	const errorBody = (await response.json().catch(() => null)) as ApiErrorResponse | null;
	return {
		ok: false as const,
		data: null,
		notModified: false as const,
		error: errorBody?.error ?? {
			code: 'NETWORK_ERROR',
			message: 'Failed to load conversation.',
			requestId: 'local'
		}
	};
}

export const conversationCache = {
	has(id: string): boolean {
		return !!entries[id];
	},

	get(id: string): GetConversationResponse | null {
		return entries[id]?.data ?? null;
	},

	isProcessing(id: string): boolean {
		const data = entries[id]?.data;
		return data ? isProcessing(data) : false;
	},

	/** Hapus ETag → revalidation berikutnya pasti mengambil data baru. */
	invalidate(id: string) {
		const entry = entries[id];
		if (entry) entry.etag = null;
	},

	clear() {
		for (const key of Object.keys(entries)) delete entries[key];
		order.length = 0;
	},

	/**
	 * SWR refresh. Caller bisa render `get(id)` dulu (instan), lalu panggil
	 * `refresh(id)` — hasil 304 menandakan cache masih valid.
	 */
	async refresh(id: string) {
		if (entries[id] && !entries[id].loading && !isProcessing(entries[id].data)) {
			touch(id);
		}
		if (entries[id]) entries[id].loading = true;
		const result = await fetchEntry(id);
		if (entries[id]) entries[id].loading = false;
		return result;
	},

	/** Sidebar hover prefetch — dilewati jika sudah cached & fresh. */
	prefetch(id: string) {
		if (entries[id]?.loading) return;
		if (entries[id] && !isStale(id) && !isProcessing(entries[id].data)) return;
		void fetchEntry(id);
	}
};
