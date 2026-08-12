import { getMe, getMeUsage } from '$lib/api/me';
import type { ApiResult } from '$lib/types/api.types';
import type { UserProfileResponse, UserUsageResponse } from '$lib/types/auth.types';

/**
 * Client-side cache (TTL 30s) untuk `/api/me` dan `/api/me/usage` agar
 * navigasi antar halaman /app/* (chat, documents, billing, sidebar) tidak
 * menembak endpoint yang sama berulang kali. Data dianggap fresh dalam TTL;
 * melewati TTL = refetch (SWR sederhana).
 */
const TTL_MS = 30_000;

const cache = $state<{
	me: { data: UserProfileResponse | null; at: number };
	usage: { data: UserUsageResponse | null; at: number };
}>({
	me: { data: null, at: 0 },
	usage: { data: null, at: 0 }
});

function isFresh(at: number): boolean {
	return at > 0 && Date.now() - at < TTL_MS;
}

export async function getMeCached(force = false): Promise<ApiResult<UserProfileResponse>> {
	if (!force && cache.me.data && isFresh(cache.me.at)) {
		return { ok: true, data: cache.me.data };
	}
	const result = await getMe();
	if (result.ok) {
		cache.me = { data: result.data, at: Date.now() };
	}
	return result;
}

export async function getMeUsageCached(force = false): Promise<ApiResult<UserUsageResponse>> {
	if (!force && cache.usage.data && isFresh(cache.usage.at)) {
		return { ok: true, data: cache.usage.data };
	}
	const result = await getMeUsage();
	if (result.ok) {
		cache.usage = { data: result.data, at: Date.now() };
	}
	return result;
}

/** Force refetch profile pada akses berikutnya (mis. setelah ganti nama). */
export function invalidateMeCache() {
	cache.me = { data: null, at: 0 };
}

/** Force refetch usage pada akses berikutnya (mis. setelah upload/QA). */
export function invalidateUsageCache() {
	cache.usage = { data: null, at: 0 };
}
