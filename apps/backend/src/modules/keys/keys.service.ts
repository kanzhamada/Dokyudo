import { withAuthDb } from "../../config/drizzle.ts";
import { tenantKeys } from "../../shared/models/db.model.ts";
import { encryptApiKey, decryptApiKey, maskApiKey } from "../../shared/utils/crypto.util.ts";
import { and, eq } from "drizzle-orm";
import { AppError } from "../../shared/utils/errors.util.ts";
import { PROVIDER_MODELS, type LlmProvider } from "../../shared/constants/llm_providers.constant.ts";
import { GoogleGenAI } from "@google/genai";

const TEST_PROMPT = "1";

/** Fastest model per provider for quick key validation. */
const FAST_MODELS: Record<string, string> = {
    gemini: "gemini-2.5-flash",
    mistral: "ministral-3b-latest",
    openrouter: "openrouter/free",
};

export class KeysService {
    static async upsertKey(params: {
        tenantId: string;
        provider: string;
        apiKey: string;
        logContext?: Record<string, any>;
    }): Promise<{ isNew: boolean }> {
        const { tenantId, provider, apiKey, logContext } = params;

        try {
            const { encryptedApiKey, iv } = await encryptApiKey(apiKey);

            let isNew = false;

            await withAuthDb(tenantId, async (tx) => {
                const [existing] = await tx
                    .select({ tenantId: tenantKeys.tenantId })
                    .from(tenantKeys)
                    .where(
                        and(
                            eq(tenantKeys.tenantId, tenantId),
                            eq(tenantKeys.provider, provider)
                        )
                    )
                    .limit(1);

                if (existing) {
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
                    isNew = true;
                }
            });

            if (logContext) logContext.keyEvent = `${isNew ? "created" : "updated"}_${provider}`;
            return { isNew };
        } catch (e: any) {
            if (logContext) logContext.keyError = e.message;
            throw new AppError({
                code: "INTERNAL_ERROR",
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
                const plaintext = await decryptApiKey(k.encryptedApiKey, k.iv);
                const models = [...(PROVIDER_MODELS[k.provider as LlmProvider] ?? [])];
                keys.push({
                    provider: k.provider,
                    maskedKey: maskApiKey(plaintext),
                    models,
                    updatedAt: k.updatedAt.toISOString(),
                });
            } catch (e) {
                keys.push({
                    provider: k.provider,
                    maskedKey: "CORRUPTED_KEY",
                    models: [...(PROVIDER_MODELS[k.provider as LlmProvider] ?? [])],
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

    static async testKey(params: {
        provider: string;
        apiKey: string;
    }): Promise<{ valid: boolean; message: string }> {
        const { provider, apiKey } = params;

        try {
            if (provider === "gemini") {
                return await testGemini(apiKey);
            }
            if (provider === "mistral") {
                return await testMistral(apiKey);
            }
            if (provider === "openrouter") {
                return await testOpenRouter(apiKey);
            }
            return { valid: false, message: `Unknown provider: ${provider}` };
        } catch (e: any) {
            return { valid: false, message: `Connection failed: ${e.message}` };
        }
    }
}

async function testGemini(apiKey: string): Promise<{ valid: boolean; message: string }> {
    const client = new GoogleGenAI({ apiKey });
    await client.models.generateContent({
        model: FAST_MODELS.gemini,
        contents: TEST_PROMPT,
    });
    return { valid: true, message: "API key is valid" };
}

async function testMistral(apiKey: string): Promise<{ valid: boolean; message: string }> {
    const { Mistral: MistralClient } = await import("npm:@mistralai/mistralai");
    const client = new MistralClient({ apiKey }) as InstanceType<typeof MistralClient>;
    await client.chat.complete({
        model: FAST_MODELS.mistral,
        messages: [{ role: "user", content: TEST_PROMPT }],
    });
    return { valid: true, message: "API key is valid" };
}

async function testOpenRouter(apiKey: string): Promise<{ valid: boolean; message: string }> {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": "https://dokyudo.com",
            "X-OpenRouter-Title": "Dokyudo",
        },
        body: JSON.stringify({
            model: FAST_MODELS.openrouter,
            messages: [{ role: "user", content: TEST_PROMPT }],
        }),
    });

    const text = await resp.text();

    if (resp.ok) return { valid: true, message: "API key is valid" };

    try {
        const json = JSON.parse(text);
        if (json?.error?.message) return { valid: false, message: json.error.message };
    } catch { /* body not JSON */ }

    return { valid: false, message: `Request failed with status ${resp.status}` };
}
