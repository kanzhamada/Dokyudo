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
 * On a write failure the error is recorded into the caller's `logContext`
 * (wide-event log) instead of being thrown — it must never break the request.
 */
export async function logActivity(
    params: LogActivityParams,
    logContext?: Record<string, any>,
): Promise<void> {
    try {
        await db.insert(activityLogs).values(params);
    } catch (err: any) {
        if (logContext) {
            logContext.activityLogWriteError = err.message;
        }
    }
}