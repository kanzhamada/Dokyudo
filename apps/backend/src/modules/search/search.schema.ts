import { z } from "@hono/zod-openapi";

export const SearchParamsSchema = z.object({
    tenantId: z.string().uuid(),
    queryText: z.string().min(1),
    limit: z.number().int().min(1).optional(),
    logContext: z.any().optional(),
});

export type SearchParams = z.infer<typeof SearchParamsSchema>;

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

export const SearchResultItemSchema = z.object({
    id: z.string().uuid(),
    documentId: z.string().uuid(),
    content: z.string(),
    score: z.number(),
}).openapi("SearchResultItem");

export const SearchResponseSchema = z.object({
    data: z.array(SearchResultItemSchema),
}).openapi("SearchResponse");
