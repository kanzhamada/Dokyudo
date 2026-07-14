import { eq, sql } from "drizzle-orm";
import { AppError } from "./errors.util.ts";
import { TIER_LIMITS } from "../constants/tiers.constant.ts";
import { tenantSubscriptions, documents } from "../models/db.model.ts";

export class TierQuotaUtil {
    
    /**
     * Helper to fetch the subscription record for a tenant
     */
    private static async getSubscription(tx: any, tenantId: string) {
        const [subscription] = await tx
            .select()
            .from(tenantSubscriptions)
            .where(eq(tenantSubscriptions.tenantId, tenantId));

        if (!subscription) {
            throw new AppError({
                code: "NOT_FOUND",
                message: "Tenant subscription not found.",
                status: 404,
            });
        }
        return subscription;
    }

    /**
     * Validates the search quota. Throws an AppError if limit is exceeded.
     */
    static async checkSearchQuota(tx: any, tenantId: string): Promise<void> {
        const subscription = await this.getSubscription(tx, tenantId);
        const tierLimits = TIER_LIMITS[subscription.tier as keyof typeof TIER_LIMITS];

        if (subscription.searchesCount >= tierLimits.maxSearchesPerMonth) {
            throw new AppError({
                code: "VALIDATION_ERROR",
                message: "Search limit exceeded. Please upgrade your tier.",
                status: 400,
            });
        }
    }

    /**
     * Atomically increments the search quota.
     */
    static async incrementSearch(tx: any, tenantId: string): Promise<void> {
        await tx
            .update(tenantSubscriptions)
            .set({ searchesCount: sql`${tenantSubscriptions.searchesCount} + 1` })
            .where(eq(tenantSubscriptions.tenantId, tenantId));
    }

    /**
     * Atomically validates and increments the search quota.
     */
    static async checkAndIncrementSearch(tx: any, tenantId: string): Promise<void> {
        await this.checkSearchQuota(tx, tenantId);
        await this.incrementSearch(tx, tenantId);
    }

    /**
     * Validates the Q&A conversation quota. Throws an AppError if limit is exceeded.
     */
    static async checkQaQuota(tx: any, tenantId: string): Promise<void> {
        const subscription = await this.getSubscription(tx, tenantId);
        const tierLimits = TIER_LIMITS[subscription.tier as keyof typeof TIER_LIMITS];

        if (subscription.qaCount >= tierLimits.maxQnaPerMonth) {
            throw new AppError({
                code: "VALIDATION_ERROR",
                message: "Q&A limit exceeded. Please upgrade your tier.",
                status: 400,
            });
        }
    }

    /**
     * Atomically increments the Q&A conversation quota.
     */
    static async incrementQa(tx: any, tenantId: string): Promise<void> {
        await tx
            .update(tenantSubscriptions)
            .set({ qaCount: sql`${tenantSubscriptions.qaCount} + 1` })
            .where(eq(tenantSubscriptions.tenantId, tenantId));
    }

    /**
     * Atomically validates and increments the Q&A conversation quota.
     */
    static async checkAndIncrementQa(tx: any, tenantId: string): Promise<void> {
        await this.checkQaQuota(tx, tenantId);
        await this.incrementQa(tx, tenantId);
    }

    /**
     * Validates upload quota constraints (file size, monthly limits, and total storage).
     * Throws an AppError if any limit is exceeded.
     */
    static async checkUploadQuota(tx: any, tenantId: string, fileSizeBytes: number): Promise<void> {
        const subscription = await this.getSubscription(tx, tenantId);
        const tierLimits = TIER_LIMITS[subscription.tier as keyof typeof TIER_LIMITS];

        // 1. Check max file size
        if (fileSizeBytes > tierLimits.maxFileSizeBytes) {
            throw new AppError({
                code: "VALIDATION_ERROR",
                message: `File size exceeds maximum allowed size of ${tierLimits.maxFileSizeBytes / (1024 * 1024)}MB for your tier.`,
                status: 400,
            });
        }

        // 2. Check max uploads per month
        if (subscription.uploadsCount >= tierLimits.maxUploadsPerMonth) {
            throw new AppError({
                code: "VALIDATION_ERROR",
                message: `Upload limit exceeded. You have reached your monthly limit of ${tierLimits.maxUploadsPerMonth} uploads. Please upgrade your tier.`,
                status: 400,
            });
        }

        // 3. Check max storage capacity
        const storageResult = await tx
            .select({ totalBytes: sql<number>`sum(${documents.sizeBytes})` })
            .from(documents)
            .where(eq(documents.tenantId, tenantId));
            
        const currentStorageUsed = Number(storageResult[0]?.totalBytes) || 0;
        
        if (currentStorageUsed + fileSizeBytes > tierLimits.maxStorageBytes) {
            throw new AppError({
                code: "VALIDATION_ERROR",
                message: `Storage limit exceeded. Your tier allows up to ${tierLimits.maxStorageBytes / (1024 * 1024)}MB.`,
                status: 400,
            });
        }
    }

    /**
     * Atomically increments the uploadsCount.
     */
    static async incrementUpload(tx: any, tenantId: string): Promise<void> {
        await tx
            .update(tenantSubscriptions)
            .set({ uploadsCount: sql`${tenantSubscriptions.uploadsCount} + 1` })
            .where(eq(tenantSubscriptions.tenantId, tenantId));
    }

    /**
     * Validates upload quota constraints for a batch of files.
     */
    static async checkUploadQuotaBatch(tx: any, tenantId: string, files: Array<{ sizeBytes: number }>): Promise<void> {
        const subscription = await this.getSubscription(tx, tenantId);
        const tierLimits = TIER_LIMITS[subscription.tier as keyof typeof TIER_LIMITS];

        const totalSizeBytes = files.reduce((sum, file) => sum + file.sizeBytes, 0);

        // 1. Check max file size for each file
        for (const file of files) {
            if (file.sizeBytes > tierLimits.maxFileSizeBytes) {
                throw new AppError({
                    code: "VALIDATION_ERROR",
                    message: `One of the files exceeds maximum allowed size of ${tierLimits.maxFileSizeBytes / (1024 * 1024)}MB for your tier.`,
                    status: 400,
                });
            }
        }

        // 2. Check max uploads per month
        if (subscription.uploadsCount + files.length > tierLimits.maxUploadsPerMonth) {
            throw new AppError({
                code: "VALIDATION_ERROR",
                message: `Batch upload exceeds your monthly limit. You have ${tierLimits.maxUploadsPerMonth - subscription.uploadsCount} uploads remaining.`,
                status: 400,
            });
        }

        // 3. Check max storage capacity
        const storageResult = await tx
            .select({ totalBytes: sql<number>`sum(${documents.sizeBytes})` })
            .from(documents)
            .where(eq(documents.tenantId, tenantId));
            
        const currentStorageUsed = Number(storageResult[0]?.totalBytes) || 0;
        
        if (currentStorageUsed + totalSizeBytes > tierLimits.maxStorageBytes) {
            throw new AppError({
                code: "VALIDATION_ERROR",
                message: `Storage limit exceeded. This batch requires ${totalSizeBytes / (1024 * 1024)}MB, but you only have ${(tierLimits.maxStorageBytes - currentStorageUsed) / (1024 * 1024)}MB remaining.`,
                status: 400,
            });
        }
    }
}
