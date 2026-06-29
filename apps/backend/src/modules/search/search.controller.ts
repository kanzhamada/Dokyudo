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

    return c.json({ data: results }, 200);
};
