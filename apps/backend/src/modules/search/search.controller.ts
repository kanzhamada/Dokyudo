import { Context } from "hono";
import { SearchService } from "./search.service.ts";
import { SearchParams } from "./search.schema.ts";
import { ContextExtractor } from "../../shared/utils/context.util.ts";

export const handleSearch = async (c: Context) => {
    const { tenantId, logContext } = new ContextExtractor(
        c,
    ).extractAuthContext();

    const { query, limit } = c.req.valid("query" as never) as any;

    const params: SearchParams = {
        tenantId,
        query,
        limit,
        logContext,
    };

    const results = await SearchService.executeHybridSearch(params);

    // Group by documentId, keeping only the highest scoring chunk (first encountered)
    const uniqueDocuments = [];
    const seenDocumentIds = new Set();
    
    for (const res of results) {
        if (!seenDocumentIds.has(res.documentId)) {
            seenDocumentIds.add(res.documentId);
            uniqueDocuments.push(res);
        }
    }

    return c.json({ data: uniqueDocuments }, 200);
};
