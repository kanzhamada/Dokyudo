import { withAuthDb } from "../../config/drizzle.ts";
import { documentChunks } from "../../shared/models/db.model.ts";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { vectorIndex } from "../../config/vector.ts";
import { redis } from "../../config/redis.ts";
import { RedisKeys } from "../../shared/constants/redis_keys.constant.ts";
import { createCircuitBreaker } from "../../infra/circuit_breaker.infra.ts";
import { gemini, GEMINI_MODELS } from "../../config/gemini.ts";
import { AppError } from "../../shared/utils/errors.util.ts";
import { SearchParams } from "./search.schema.ts";

// Protect the external LLM Embedding API with a Circuit Breaker
const embeddingCB = createCircuitBreaker("llm-embedding");

export class SearchService {
    private static async getEmbedding(params: SearchParams): Promise<number[]> {
        const cacheKey = await RedisKeys.embeddingCache(
            GEMINI_MODELS.embedding,
            params.queryText,
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
            safeValues = await gemini.generateEmbedding(params.queryText);
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

    static async executeHybridSearch(params: SearchParams) {
        const { tenantId, queryText, limit = 10, logContext } = params;

        const k = 60; 

        const rankCalc = sql<number>`ts_rank(${documentChunks.fts}, (websearch_to_tsquery('indonesian', ${queryText}) || websearch_to_tsquery('english', ${queryText})))`;

        const ftsPromise = withAuthDb(tenantId, async (tx) => {
            return await tx
                .select({
                    id: documentChunks.id,
                    rank: rankCalc,
                })
                .from(documentChunks)
                .where(
                    and(
                        eq(documentChunks.tenantId, tenantId),
                        sql`${documentChunks.fts} @@ (websearch_to_tsquery('indonesian', ${queryText}) || websearch_to_tsquery('english', ${queryText}))`,
                    ),
                )
                .orderBy(desc(rankCalc))
                .limit(limit * 2);
        });

        const vectorPromise = (async () => {
            const embedding = await embeddingCB.execute(() =>
                SearchService.getEmbedding(params),
            );

            const vec = await vectorIndex.query({
                vector: embedding,
                topK: limit * 2,
                includeMetadata: false,
                includeVectors: false,
                filter: `tenantId = '${tenantId}'`,
            });
            const vecLen = vec.length;
            const vecMapped = new Array(vecLen);
            for (let i = 0; i < vecLen; i++) {
                vecMapped[i] = { id: vec[i].id as string, rank: i + 1 };
            }

            return vecMapped;
        })();

        let ftsResults: { id: string; rank: number }[] | null = null;
        let vectorIds: { id: string; rank: number }[] | null = null;

        try {
            const [fts, vec] = await Promise.all([ftsPromise, vectorPromise]);

            ftsResults = fts;
            vectorIds = vec;
        } catch (err: any) {
            if (logContext) {
                logContext.searchEvent = "hybrid_search_failed";
                logContext.searchError = err.message;
            }
        }

        if (!ftsResults || !vectorIds) {
            throw new AppError({
                code: "INTERNAL_ERROR",
                message: "Hybrid search execution failed",
                status: 500,
            });
        }

        const scores = new Map<string, number>();

        const lenVector = vectorIds.length;
        for (let i = 0; i < lenVector; i++) {
            const res = vectorIds[i];
            scores.set(res.id, (scores.get(res.id) || 0) + 1 / (k + res.rank));
        }

        const lenFts = ftsResults.length;
        for (let i = 0; i < lenFts; i++) {
            const res = ftsResults[i];
            const rank = i + 1;
            scores.set(res.id, (scores.get(res.id) || 0) + 1 / (k + rank));
        }

        if (scores.size === 0) return [];

        const sortedIds = Array.from(scores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit);
        const topIdsLen = sortedIds.length;
        const topIds = new Array(topIdsLen);
        for (let i = 0; i < topIdsLen; i++) {
            topIds[i] = sortedIds[i][0];
        }
        
        const chunks = await withAuthDb(tenantId, async (tx) => {
            return await tx
                .select({
                    id: documentChunks.id,
                    documentId: documentChunks.documentId,
                    content: documentChunks.content,
                })
                .from(documentChunks)
                .where(inArray(documentChunks.id, topIds));
        });

        const chunkMap = new Map();
        const lenChunks = chunks.length;
        for (let i = 0; i < lenChunks; i++) {
            chunkMap.set(chunks[i].id, chunks[i]);
        }

        const results = [];
        for (let i = 0; i < topIdsLen; i++) {
            const id = sortedIds[i][0];
            const score = sortedIds[i][1];
            const chunk = chunkMap.get(id);
            if (chunk) {
                results.push({ ...chunk, score });
            }
        }

        return results;
    }
}
