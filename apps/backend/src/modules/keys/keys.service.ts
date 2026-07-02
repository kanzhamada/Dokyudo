import { withAuthDb } from "../../config/drizzle.ts";
import { tenantKeys } from "../../shared/models/db.model.ts";
import { encryptApiKey, decryptApiKey, maskApiKey } from "../../shared/utils/crypto.util.ts";
import { and, eq } from "drizzle-orm";
import { AppError } from "../../shared/utils/errors.util.ts";

export class KeysService {
    static async upsertKey(params: {
        tenantId: string;
        provider: string;
        apiKey: string;
        logContext?: Record<string, any>;
    }) {
        const { tenantId, provider, apiKey, logContext } = params;

        try {
            const { encryptedApiKey, iv } = await encryptApiKey(apiKey);

            await withAuthDb(tenantId, async (tx) => {
                const existing = await tx
                    .select()
                    .from(tenantKeys)
                    .where(
                        and(
                            eq(tenantKeys.tenantId, tenantId),
                            eq(tenantKeys.provider, provider)
                        )
                    );

                if (existing.length > 0) {
                    await tx
                        .update(tenantKeys)
                        .set({ encryptedApiKey, iv, updatedAt: new Date() })
                        .where(
                            and(
                                eq(tenantKeys.tenantId, tenantId),
                                eq(tenantKeys.provider, provider)
                            )
                        );
                } else {
                    await tx
                        .insert(tenantKeys)
                        .values({ tenantId, provider, encryptedApiKey, iv });
                }
            });

            if (logContext) logContext.keyEvent = `upserted_${provider}`;
            return { success: true };
        } catch (e: any) {
            if (logContext) logContext.keyError = e.message;
            throw new AppError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to encrypt and store API key",
                status: 500,
            });
        }
    }

    static async getKeys(params: { tenantId: string; logContext?: Record<string, any> }) {
        const { tenantId } = params;

        let results: any[] = [];
        await withAuthDb(tenantId, async (tx) => {
            results = await tx
                .select()
                .from(tenantKeys)
                .where(eq(tenantKeys.tenantId, tenantId));
        });

        const keys = [];
        for (const k of results) {
            try {
                // Decrypt purely in memory to show a realistic masked string (e.g. sk-...1234)
                const plaintext = await decryptApiKey(k.encryptedApiKey, k.iv);
                keys.push({
                    provider: k.provider,
                    maskedKey: maskApiKey(plaintext),
                    updatedAt: k.updatedAt.toISOString(),
                });
            } catch (e) {
                keys.push({
                    provider: k.provider,
                    maskedKey: "CORRUPTED_KEY",
                    updatedAt: k.updatedAt.toISOString(),
                });
            }
        }
        return keys;
    }

    static async deleteKey(params: { tenantId: string; provider: string; logContext?: Record<string, any> }) {
        const { tenantId, provider, logContext } = params;

        await withAuthDb(tenantId, async (tx) => {
            const result = await tx
                .delete(tenantKeys)
                .where(
                    and(
                        eq(tenantKeys.tenantId, tenantId),
                        eq(tenantKeys.provider, provider)
                    )
                )
                .returning({ id: tenantKeys.tenantId });

            if (result.length === 0) {
                throw new AppError({
                    code: "NOT_FOUND",
                    message: "Key not found for this provider",
                    status: 404,
                });
            }
        });
        
        if (logContext) logContext.keyEvent = `deleted_${provider}`;
    }
}
