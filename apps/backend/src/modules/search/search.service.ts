import { withAuthDb } from "../../config/drizzle.ts";
import { documentChunks, documents } from "../../shared/models/db.model.ts";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { vectorIndex } from "../../config/vector.ts";
import { redis } from "../../config/redis.ts";
import { RedisKeys } from "../../shared/constants/redis_keys.constant.ts";
import { createCircuitBreaker } from "../../infra/circuit_breaker.infra.ts";
import { cloudflare, CLOUDFLARE_MODELS } from "../../config/cloudflare.ts";
import { AppError } from "../../shared/utils/errors.util.ts";
import { TierQuotaUtil } from "../../shared/utils/tier_quota.util.ts";
import { SearchParams } from "./search.schema.ts";
import { DEFAULT_FUSION, fuseWithRRF, type FusionConfig, type RankedId } from "./rrf.ts";

// Protect the external LLM Embedding API with a Circuit Breaker
const embeddingCB = createCircuitBreaker("llm-embedding");

export interface SearchResult {
    id: string;
    documentId: string;
    documentTitle: string;
    metadata: unknown;
    content: string;
    score: number;
}

export class SearchService {
    private static async getEmbedding(params: SearchParams): Promise<number[]> {
        const cacheKey = await RedisKeys.embeddingCache(
            CLOUDFLARE_MODELS.embedding,
            params.query,
        );
        
        let cached: number[] | null = null;
        
        try {
            cached = await redis.get<number[]>(cacheKey);
        } catch (e: any) {
            if (params.logContext) {
                params.logContext.searchEvent = "embedding_cache_read_failed";
                params.logContext.searchError = e.message;
            }
        }

        if (cached) {
            return cached;
        }

        let safeValues: number[] | null = null;
        
        try {
            safeValues = await cloudflare.generateEmbedding(params.query);
        } catch (e: any) {
            if (params.logContext) {
                params.logContext.searchEvent = "llm_embedding_failed";
                params.logContext.searchError = e.message;
            }
        }

        if (!safeValues) {
            throw new AppError({
                code: "PROVIDER_UNAVAILABLE",
                message: "Failed to generate embedding from LLM",
                status: 503,
            });
        }

        try {
            await redis.set(cacheKey, safeValues, { ex: 2592000 });
        } catch (e: any) {
            if (params.logContext) {
                params.logContext.searchEvent = "embedding_cache_write_failed";
                params.logContext.searchError = e.message;
            }
        }

        return safeValues;
    }

    /**
     * Production entry point. Fuses with a single config — by default the
     * original behavior (k=60, equal 1:1 weights), overridable via optional
     * `rrfK` / `ftsWeight` / `vectorWeight` params for experiments.
     */
    static async executeHybridSearch(params: SearchParams): Promise<SearchResult[]> {
        const configs: FusionConfig[] = (params.fusionConfigs ?? [
            {
                k: params.rrfK ?? DEFAULT_FUSION.k,
                ftsWeight: params.ftsWeight ?? DEFAULT_FUSION.ftsWeight,
                vectorWeight: params.vectorWeight ?? DEFAULT_FUSION.vectorWeight,
            },
        ]).map((cfg) => ({
            k: cfg.k ?? DEFAULT_FUSION.k,
            ftsWeight: cfg.ftsWeight ?? DEFAULT_FUSION.ftsWeight,
            vectorWeight: cfg.vectorWeight ?? DEFAULT_FUSION.vectorWeight,
        }));
        const results = await SearchService.executeHybridSearchForConfigs(params, configs);
        return results[0] ?? [];
    }

    /**
     * Benchmark sweep entry point: runs the same candidate fetch once and
     * evaluates multiple fusion configs against it. One search call serves all
     * configs (no extra quota / API cost per config).
     */
    static async executeHybridSearchForConfigs(
        params: SearchParams,
        configs: FusionConfig[],
    ): Promise<SearchResult[][]> {
        const { tenantId, query, limit = 10, logContext, skipQuota, documentIds } = params;
        const scopedToDocuments = documentIds && documentIds.length > 0;

        // -1. Tier Quota Validation & Enforcement (Atomic)
        // Skipped when the benchmark runs with `skipQuota` — benchmarking should
        // not consume a tenant's production search quota.
        if (!skipQuota) {
            await withAuthDb(tenantId, async (tx) => {
                await TierQuotaUtil.checkAndIncrementSearch(tx, tenantId);
            });
        }

        const rankCalc = sql<number>`ts_rank(${documentChunks.fts}, (websearch_to_tsquery('indonesian', ${query}) || websearch_to_tsquery('english', ${query})))`;

        const ftsConditions = [
            eq(documentChunks.tenantId, tenantId),
            sql`${documentChunks.fts} @@ (websearch_to_tsquery('indonesian', ${query}) || websearch_to_tsquery('english', ${query}))`,
        ];
        // Chat-attachment mode: only chunks of the attached documents compete.
        if (scopedToDocuments) ftsConditions.push(inArray(documentChunks.documentId, documentIds!));

        const ftsPromise = (async () => {
            try {
                return await withAuthDb(tenantId, async (tx) => {
                    return await tx
                        .select({
                            id: documentChunks.id,
                            rank: rankCalc,
                        })
                        .from(documentChunks)
                        .where(and(...ftsConditions))
                        .orderBy(desc(rankCalc))
                        .limit(limit * 2);
                });
            } catch (err: any) {
                if (logContext) {
                    logContext.searchEvent = "fts_search_failed_graceful_degradation";
                    logContext.searchError = err.message;
                }
                return [];
            }
        })();

        const vectorPromise = (async () => {
            try {
                const embedding = await embeddingCB.execute(() =>
                    SearchService.getEmbedding(params),
                );

                // Chat-attachment mode: Upstash metadata filter scoped to the
                // attached documents (UUIDs only — safe to inline).
                let filter = `tenantId = '${tenantId}'`;
                if (scopedToDocuments) {
                    const ids = documentIds!.map((id) => `'${id}'`).join(", ");
                    filter += ` AND documentId in (${ids})`;
                }

                const vec = await vectorIndex.query({
                    vector: embedding,
                    topK: limit * 2,
                    includeMetadata: false,
                    includeVectors: false,
                    filter,
                });
                const vecLen = vec.length;
                const vecMapped = new Array(vecLen);
                for (let i = 0; i < vecLen; i++) {
                    vecMapped[i] = { id: vec[i].id as string, rank: i + 1 };
                }

                return vecMapped;
            } catch (err: any) {
                if (logContext) {
                    logContext.searchEvent = "vector_search_failed_graceful_degradation";
                    logContext.searchError = err.message;
                }
                // Gracefully degrade by returning empty vector results
                return [];
            }
        })();

        let ftsResults: { id: string; rank: number }[] = [];
        let vectorIds: RankedId[] = [];

        try {
            const [fts, vec] = await Promise.all([ftsPromise, vectorPromise]);

            ftsResults = fts;
            vectorIds = vec;
        } catch (err: any) {
            if (logContext) {
                logContext.searchEvent = "hybrid_search_promise_all_failed";
                logContext.searchError = err.message;
            }
        }

        // Per-config ranked id lists (fusion is in-memory — cheap to sweep).
        const ftsRanked: RankedId[] = ftsResults.map((r, i) => ({ id: r.id, rank: i + 1 }));
        const perConfig = configs.map((cfg) =>
            fuseWithRRF(vectorIds, ftsRanked, cfg).slice(0, limit),
        );

        if (perConfig.every((list) => list.length === 0)) {
            return configs.map(() => []);
        }

        // Union of ids across configs, fetched in a single query.
        const idSet = new Set<string>();
        for (const list of perConfig) {
            for (const r of list) idSet.add(r.id);
        }
        const topIds = Array.from(idSet);

        const chunks = await withAuthDb(tenantId, async (tx) => {
            const chunkConditions = [
                inArray(documentChunks.id, topIds),
                eq(documentChunks.tenantId, tenantId),
            ];
            // Defensive: fused ids already came from scoped queries, but keep
            // the final fetch scoped too so a chunk can never leak in.
            if (scopedToDocuments) chunkConditions.push(inArray(documentChunks.documentId, documentIds!));
            return await tx
                .select({
                    id: documentChunks.id,
                    documentId: documentChunks.documentId,
                    documentTitle: documents.title,
                    metadata: documentChunks.metadata,
                    content: documentChunks.content,
                })
                .from(documentChunks)
                .innerJoin(documents, eq(documentChunks.documentId, documents.id))
                .where(and(...chunkConditions));
        });

        const chunkMap = new Map();
        const lenChunks = chunks.length;
        for (let i = 0; i < lenChunks; i++) {
            chunkMap.set(chunks[i].id, chunks[i]);
        }

        return perConfig.map((list) =>
            list
                .map((r) => {
                    const chunk = chunkMap.get(r.id);
                    return chunk ? { ...chunk, score: r.score } : null;
                })
                .filter((x): x is SearchResult => x !== null),
        );
    }
}
