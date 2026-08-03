import { db, withAuthDb } from "../../config/drizzle.ts";
import { users, tenants, tenantSubscriptions } from "../../shared/models/db.model.ts";
import { eq } from "drizzle-orm";
import { AppError } from "../../shared/utils/errors.util.ts";
import * as MeParams from "./me.schema.ts";
import { TIER_LIMITS, type TierType } from "../../shared/constants/tiers.constant.ts";

export class MeService {
    static async getProfile(params: {
        userId: string;
        tenantId: string;
        logContext?: Record<string, any>;
    }): Promise<MeParams.ProfileResponse> {
        const [userRecord] = await db
            .select()
            .from(users)
            .where(eq(users.id, params.userId));

        if (!userRecord) {
            throw new AppError({
                code: "NOT_FOUND",
                message: "User not found",
                status: 404,
            });
        }

        const [tenantRecord] = await db
            .select()
            .from(tenants)
            .where(eq(tenants.id, params.tenantId));

        if (!tenantRecord) {
            throw new AppError({
                code: "NOT_FOUND",
                message: "Tenant not found",
                status: 404,
            });
        }

        const [subscription] = await db
            .select()
            .from(tenantSubscriptions)
            .where(eq(tenantSubscriptions.tenantId, params.tenantId));

        if (!subscription) {
            throw new AppError({
                code: "NOT_FOUND",
                message: "Subscription not found",
                status: 404,
            });
        }

        let currentTier = subscription.tier;
        let expiresAt = subscription.expiresAt;

        // Lazy Evaluation: Auto-Downgrade
        if (expiresAt && new Date() > expiresAt && currentTier !== "FREE") {
            currentTier = "FREE";
            expiresAt = null;

            await db
                .update(tenantSubscriptions)
                .set({
                    tier: "FREE",
                    expiresAt: null,
                    updatedAt: new Date(),
                })
                .where(eq(tenantSubscriptions.tenantId, params.tenantId));

            if (params.logContext) {
                params.logContext.meEvent = "tier_auto_downgraded";
                params.logContext.oldTier = subscription.tier;
            }
        }

        return {
            user: {
                id: userRecord.id,
                email: userRecord.email,
                profilePictureUrl: userRecord.profilePictureUrl,
            },
            tenant: {
                id: tenantRecord.id,
                name: tenantRecord.name,
            },
            subscription: {
                tier: currentTier,
                expiresAt: expiresAt?.toISOString() || null,
            },
        };
    }

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
