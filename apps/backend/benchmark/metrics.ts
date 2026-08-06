/**
 * Pure metric helpers for the RAG retrieval benchmark.
 * Kept dependency-free so they can be unit-tested with `deno test`.
 */

export interface RankedChunk {
    id: string;
    documentId: string;
}

/**
 * Unique document ids in first-seen order — mirrors how the search
 * controller groups results (`search.controller.ts`).
 */
export function uniqueDocumentIds(results: RankedChunk[]): string[] {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const result of results) {
        if (!seen.has(result.documentId)) {
            seen.add(result.documentId);
            ids.push(result.documentId);
        }
    }
    return ids;
}

/**
 * Fraction of golden documents found within the top-k ranked results.
 * Returns 0 when the golden set is empty.
 */
export function recallAtK(golden: string[], ranked: string[], k: number): number {
    if (golden.length === 0) return 0;
    const topK = new Set(ranked.slice(0, k));
    let hits = 0;
    for (const id of golden) {
        if (topK.has(id)) hits += 1;
    }
    return hits / golden.length;
}

/**
 * Reciprocal rank of the first golden document within the top-k results
 * (1/rank, or 0 when none of the golden documents appear in top-k).
 */
export function mrrAtK(golden: string[], ranked: string[], k: number): number {
    const limit = Math.min(k, ranked.length);
    const goldenSet = new Set(golden);
    for (let i = 0; i < limit; i += 1) {
        if (goldenSet.has(ranked[i])) return 1 / (i + 1);
    }
    return 0;
}

export function mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Linear-interpolated percentile; `p` in [0, 100]. */
export function percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    if (sorted.length === 1) return sorted[0];
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    const frac = idx - lo;
    return sorted[lo] + (sorted[hi] - sorted[lo]) * frac;
}
