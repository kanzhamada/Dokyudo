import { db } from "../../config/drizzle.ts";
import { activityLogs } from "../../shared/models/db.model.ts";
import { count, desc, eq } from "drizzle-orm";
import { AppError } from "../../shared/utils/errors.util.ts";

export class ActivitiesService {
    static async getActivities(params: {
        tenantId: string;
        page: number;
        limit: number;
    }) {
        const { tenantId, page, limit } = params;
        const offset = (page - 1) * limit;

        try {
            const [totalResult] = await db
                .select({ count: count() })
                .from(activityLogs)
                .where(eq(activityLogs.tenantId, tenantId));

            const total = totalResult.count;
            const totalPages = Math.ceil(total / limit);

            const activities = await db
                .select({
                    id: activityLogs.id,
                    action: activityLogs.action,
                    resourceType: activityLogs.resourceType,
                    resourceId: activityLogs.resourceId,
                    metadata: activityLogs.metadata,
                    ipAddress: activityLogs.ipAddress,
                    userAgent: activityLogs.userAgent,
                    createdAt: activityLogs.createdAt,
                })
                .from(activityLogs)
                .where(eq(activityLogs.tenantId, tenantId))
                .orderBy(desc(activityLogs.createdAt))
                .limit(limit)
                .offset(offset);

            return {
                data: activities.map(a => ({
                    ...a,
                    createdAt: a.createdAt?.toISOString() ?? new Date().toISOString(),
                })),
                meta: {
                    page,
                    limit,
                    total,
                    totalPages,
                },
            };
        } catch (err: any) {
            throw new AppError({
                code: "INTERNAL_ERROR",
                message: err,
                status: 500,
            });
        }
    }
}
