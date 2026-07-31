import { db } from "../../config/drizzle.ts";
import { activityLogs, activityActionEnum } from "../models/db.model.ts";

export type ActivityAction = typeof activityActionEnum.enumValues[number];

export interface LogActivityParams {
    tenantId: string;
    userId?: string;
    action: ActivityAction;
    resourceType?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    requestId?: string;
    ipAddress?: string;
    userAgent?: string;
}

/**
 * Helper to log user and system activities.
 * Awaited to ensure execution completes in serverless environments.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
    try {
        await db.insert(activityLogs).values(params);
    } catch (err: any) {
        // We log the error but don't throw it, so we don't break the main request
        console.error(JSON.stringify({
            event: "activity_log.write_failed",
            error: err.message,
            context: params
        }));
    }
}
