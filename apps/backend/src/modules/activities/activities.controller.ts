import type { Context } from "hono";
import { ActivitiesService } from "./activities.service.ts";
import { ContextExtractor } from "../../shared/utils/context.util.ts";
import type { GetActivitiesQuery } from "./activities.schema.ts";

export class ActivitiesController {
    static async handleGetActivities(c: Context) {
        const extractor = new ContextExtractor(c);
        const { tenantId } = extractor.extractAuthContext();
        const query = extractor.extractValidQuery<GetActivitiesQuery>();

        const page = parseInt(query.page || "1", 10);
        const limit = parseInt(query.limit || "10", 10);

        const result = await ActivitiesService.getActivities({
            tenantId,
            page: isNaN(page) || page < 1 ? 1 : page,
            limit: isNaN(limit) || limit < 1 ? 10 : limit,
            category: query.category,
            startDate: query.startDate,
            endDate: query.endDate,
            search: query.search,
        });

        return c.json(result, 200);
    }
}
