import { withAuthDb } from "../../config/drizzle.ts";
import { tenantKeys } from "../../shared/models/db.model.ts";
import { encryptApiKey, decryptApiKey, maskApiKey } from "../../shared/utils/crypto.util.ts";
import { and, eq } from "drizzle-orm";
import { AppError } from "../../shared/utils/errors.util.ts";
import { PROVIDER_MODELS, type LlmProvider } from "../../shared/constants/llm_providers.constant.ts";

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
            const resp = await fetch(TEST_ENDPOINTS[provider]!.url(apiKey), {
                method: "POST",
                headers: TEST_ENDPOINTS[provider]!.headers(apiKey),
                body: JSON.stringify(TEST_ENDPOINTS[provider]!.body),
            });

            const text = await resp.text();

            if (resp.ok) return { valid: true, message: "API key is valid" };

            const parsed = parseTestError(provider, resp.status, text);
            return { valid: false, message: parsed };
        } catch (e: any) {
            return { valid: false, message: `Connection failed: ${e.message}` };
        }
    }
}

const TEST_ENDPOINTS: Record<string, {
    url: (key: string) => string;
    headers: (key: string) => Record<string, string>;
    body: Record<string, unknown>;
}> = {
    gemini: {
        url: (key: string) =>
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`,
        headers: () => ({ "Content-Type": "application/json" }),
        body: { contents: [{ parts: [{ text: "1" }] }] },
    },
    mistral: {
        url: () => "https://api.mistral.ai/v1/chat/completions",
        headers: (key: string) => ({
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
        }),
        body: {
            model: "ministral-3b-latest",
            messages: [{ role: "user", content: "1" }],
            max_tokens: 1,
        },
    },
    openrouter: {
        url: () => "https://openrouter.ai/api/v1/chat/completions",
        headers: (key: string) => ({
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
            "HTTP-Referer": "https://dokyudo.app",
            "X-Title": "Dokyudo",
        }),
        body: {
            model: "openai/gpt-3.5-turbo",
            messages: [{ role: "user", content: "1" }],
            max_tokens: 1,
        },
    },
};

function parseTestError(provider: string, status: number, body: string): string {
    try {
        const json = JSON.parse(body);

        if (provider === "gemini") {
            const reason = json?.error?.status || json?.error?.message;
            if (status === 400 && reason) return `Invalid API key (${reason})`;
            return `API request failed (${status})`;
        }

        if (provider === "mistral") {
            if (status === 401) return "Invalid API Key";
            if (json?.detail) return json.detail;
            return `API request failed (${status})`;
        }

        if (provider === "openrouter") {
            if (status === 401) return "Invalid API key";
            if (json?.error?.message) return json.error.message;
            return `API request failed (${status})`;
        }

        return `Request failed with status ${status}`;
    } catch {
        return `Request failed with status ${status}`;
    }
}
