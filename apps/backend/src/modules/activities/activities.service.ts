import { db } from "../../config/drizzle.ts";
import { activityLogs } from "../../shared/models/db.model.ts";
import { and, count, desc, eq, gte, lte, like, sql } from "drizzle-orm";
import { AppError } from "../../shared/utils/errors.util.ts";

export class ActivitiesService {
    static async getActivities(params: {
        tenantId: string;
        page: number;
        limit: number;
        category?: string;
        startDate?: string;
        endDate?: string;
        search?: string;
    }) {
        const { tenantId, page, limit, category, startDate, endDate, search } = params;
        const offset = (page - 1) * limit;

        const conditions = [eq(activityLogs.tenantId, tenantId)];

        if (category) {
            const categoryPattern = `${category}.%`;
            conditions.push(sql`${activityLogs.action}::text LIKE ${categoryPattern}`);
        }

        if (startDate) {
            const start = new Date(startDate);
            if (!isNaN(start.getTime())) {
                conditions.push(gte(activityLogs.createdAt, start));
            }
        }

        if (endDate) {
            const end = new Date(endDate);
            if (!isNaN(end.getTime())) {
                conditions.push(lte(activityLogs.createdAt, end));
            }
        }

        if (search && search.trim()) {
            const searchPattern = `%${search.trim().toLowerCase()}%`;
            conditions.push(
                sql`(LOWER(${activityLogs.action}::text) LIKE ${searchPattern} OR LOWER(COALESCE(${activityLogs.metadata}::text, '')) LIKE ${searchPattern} OR LOWER(COALESCE(${activityLogs.ipAddress}, '')) LIKE ${searchPattern})`
            );
        }

        const whereClause = and(...conditions);

        try {
            const [totalResult] = await db
                .select({ count: count() })
                .from(activityLogs)
                .where(whereClause);

            const total = totalResult.count;
            const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

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
                .where(whereClause)
                .orderBy(desc(activityLogs.createdAt))
                .limit(limit)
                .offset(offset);

            return {
                data: activities.map(a => {
                    const activity = {
                        ...a,
                        createdAt: a.createdAt?.toISOString() ?? new Date().toISOString(),
                    };
                    if (typeof a.action === 'string' && a.action.startsWith('billing.')) {
                        delete (activity as any).userAgent;
                    }
                    return activity;
                }),
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
                message: err.message || "Failed to fetch activity logs",
                status: 500,
            });
        }
    }
}
