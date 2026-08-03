import { withAuthDb } from "../../config/drizzle.ts";
import { tenantSubscriptions } from "../../shared/models/db.model.ts";
import { eq } from "drizzle-orm";
import { AppError } from "../../shared/utils/errors.util.ts";
import * as MeParams from "./me.schema.ts";
import { TIER_LIMITS, type TierType } from "../../shared/constants/tiers.constant.ts";

export class MeService {
    static async getUsage(params: {
        tenantId: string;
        userId: string;
        logContext?: Record<string, any>;
    }): Promise<MeParams.UsageResponse> {
        const [subscription] = await withAuthDb(params.userId, async (tx) => {
            return await tx
                .select({
                    tier: tenantSubscriptions.tier,
                    uploadsCount: tenantSubscriptions.uploadsCount,
                    searchesCount: tenantSubscriptions.searchesCount,
                    qaCount: tenantSubscriptions.qaCount,
                    storageUsedBytes: tenantSubscriptions.storageUsedBytes,
                })
                .from(tenantSubscriptions)
                .where(eq(tenantSubscriptions.tenantId, params.tenantId));
        });

        if (!subscription) {
            throw new AppError({
                code: "NOT_FOUND",
                message: "Subscription not found",
                status: 404,
            });
        }

        const rawTier = (subscription.tier as TierType) ?? "FREE";
        const tier: TierType = TIER_LIMITS[rawTier] ? rawTier : "FREE";

        if (params.logContext) {
            params.logContext.meEvent = "get_usage_success";
            params.logContext.tier = tier;
        }

        return {
            tier,
            uploadsCount: subscription.uploadsCount,
            searchesCount: subscription.searchesCount,
            qaCount: subscription.qaCount,
            storageUsedBytes: subscription.storageUsedBytes,
        };
    }
}
