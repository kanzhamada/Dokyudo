import { z } from "@hono/zod-openapi";

export const SearchQuerySchema = z.object({
    query: z.string().min(1).openapi({
        example: "What is the return policy?",
        description: "The natural language search query",
    }),
    limit: z.coerce.number().int().min(1).max(50).default(10).openapi({
        example: 5,
        description: "Maximum number of results to return",
    }),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export const SearchParamsSchema = SearchQuerySchema.extend({
    tenantId: z.string().uuid(),
    logContext: z.any().optional(),
    /**
     * Restrict the candidate pool to these documents only (chat-attachment
     * mode). Absent = tenant-wide search. Max 10 — the chat attachment cap.
     */
    documentIds: z.array(z.string().uuid()).max(10).optional(),
    // Fusion tuning (benchmark/experiments only; the HTTP endpoint never sets
    // these, so production falls back to the defaults in rrf.ts).
    rrfK: z.number().min(1).max(1000).optional(),
    ftsWeight: z.number().min(0).max(10).optional(),
    vectorWeight: z.number().min(0).max(10).optional(),
    /** Multiple fusion configs evaluated in one fetch — benchmark sweep mode. */
    fusionConfigs: z
        .array(
            z.object({
                k: z.number().min(1).max(1000),
                ftsWeight: z.number().min(0).max(10),
                vectorWeight: z.number().min(0).max(10),
            }),
        )
        .min(1)
        .optional(),
    /** Benchmark-only: skip the tenant search-quota check/increment. No HTTP path sets this. */
    skipQuota: z.boolean().optional(),
});
export type SearchParams = z.infer<typeof SearchParamsSchema>;

export const SearchResultItemSchema = z.object({
    id: z.string().uuid(),
    documentId: z.string().uuid(),
    content: z.string(),
    score: z.number(),
}).openapi("SearchResultItem");

export const SearchResponseSchema = z.object({
    data: z.array(SearchResultItemSchema),
}).openapi("SearchResponse");
