import { db } from "../../config/drizzle.ts";
import { activityLogs } from "../models/db.model.ts";
import type { activityActionEnum } from "../models/db.model.ts";

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
 * Fire-and-forget helper to log user and system activities asynchronously.
 * Does not block the main request execution.
 */
export function logActivity(params: LogActivityParams): void {
    // We execute this asynchronously using a Promise without awaiting it.
    // Use the superuser db instance (not withAuthDb) because this is a system audit trail.
    db.insert(activityLogs).values(params).catch((err) => {
        // We log the error but don't throw it, so we don't break the main request
        console.error(JSON.stringify({
            event: "activity_log.write_failed",
            error: err.message,
            context: params
        }));
    });
}
