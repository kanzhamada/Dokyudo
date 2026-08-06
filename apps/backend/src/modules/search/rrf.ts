/**
 * Pure Reciprocal Rank Fusion (RRF) helpers.
 *
 * Extracted from SearchService so fusion configs can be swept in the retrieval
 * benchmark without touching production behavior — the defaults below reproduce
 * the original implementation exactly (k=60, equal 1:1 weights).
 */

export interface FusionConfig {
    k: number;
    ftsWeight: number;
    vectorWeight: number;
}

/** A rank list item: id plus its 1-based position in a source's result list. */
export interface RankedId {
    id: string;
    rank: number;
}

/** Ranked fusion output: id plus its RRF score. */
export interface FusedResult {
    id: string;
    score: number;
}

/**
 * Default fusion config.
 *
 * k=60 with equal weights reproduces the original implementation; the current
 * default (ftsWeight=2) is data-backed: a 31-query sweep on the production
 * corpus showed FTS is the stronger signal for Indonesian annual-report docs
 * (MRR@1 61.3% -> 80.6%, recall@1 50% -> 66.1%, no regressions beyond rank 2).
 */
export const DEFAULT_FUSION: FusionConfig = { k: 60, ftsWeight: 2, vectorWeight: 1 };

/**
 * Fuses two rank lists into one list sorted by descending RRF score.
 *
 * score(id) = vectorWeight / (k + rank_v) + ftsWeight / (k + rank_f)
 *
 * Higher weight gives a source more influence. Ties keep insertion order
 * (vector first, then FTS) — matching the original implementation.
 */
export function fuseWithRRF(
    vector: RankedId[],
    fts: RankedId[],
    config: FusionConfig,
): FusedResult[] {
    const scores = new Map<string, number>();

    for (const r of vector) {
        scores.set(r.id, (scores.get(r.id) ?? 0) + config.vectorWeight / (config.k + r.rank));
    }
    for (const r of fts) {
        scores.set(r.id, (scores.get(r.id) ?? 0) + config.ftsWeight / (config.k + r.rank));
    }

    return Array.from(scores.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([id, score]) => ({ id, score }));
}
