/**
 * FallbackLlmService — System-owned free-tier RAG chat fallback rotation.
 *
 * Rotation strategy:
 * 1. Estimate prompt tokens → select tier (LIGHT / MEDIUM / HEAVY)
 * 2. Iterate pool in priority order (non-emergency first)
 * 3. For each candidate:
 *    a. Check circuit breaker (Redis) — skip if OPEN
 *    b. Check RPM quota (Redis INCR + 60s TTL)
 *    c. Check RPD quota if documented (Redis INCR + TTL until midnight)
 *    d. Call provider → return AsyncIterable<{text}> stream on success
 *    e. On 429 / 5xx → record failure, trip circuit breaker if threshold hit
 * 4. If all non-emergency exhausted → retry with emergency pool
 * 5. If all exhausted → throw 429 AppError
 *
 * Provider API notes:
 * - Gemini:     @google/genai SDK (streaming native)
 * - Mistral:    @mistralai/mistralai SDK (streaming native)
 * - Groq:       OpenAI-compatible SSE  (choices[0].delta.content)
 * - SambaNova:  OpenAI-compatible SSE  (choices[0].delta.content)
 * - Cohere:     v2 Chat API SSE        (content-delta event → delta.text)
 */

import { GoogleGenAI } from "@google/genai";
import { redis } from "../../config/redis.ts";
import { getEnv } from "../../config/env.ts";
import { AppError } from "../../shared/utils/errors.util.ts";
import { RedisKeys } from "../../shared/constants/redis_keys.constant.ts";
import { CB_DEFAULTS } from "../../shared/constants/circuit_breaker.constant.ts";
import {
    selectTier,
    getRotationPool,
    estimateTokenCount,
    type PoolEntry,
} from "../../shared/constants/free_model_pool.constant.ts";
import {
    getFreeModelMeta,
    type FreeProvider,
} from "../../shared/constants/free_providers.constant.ts";

export interface FallbackStreamResponse {
    stream: AsyncIterable<{ text: string }>;
    provider: FreeProvider;
    modelId: string;
}

// ==============================================================================
// 1. REDIS QUOTA HELPERS
// ==============================================================================

/** Seconds remaining until midnight UTC — used as RPD key TTL */
function secondsUntilMidnightUtc(): number {
    const now = new Date();
    const midnight = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
    ));
    return Math.ceil((midnight.getTime() - now.getTime()) / 1000);
}

/**
 * Atomically increment a Redis counter and set TTL if it's the first call.
 * Returns the new counter value after increment.
 */
async function incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const val = await redis.incr(key);
    if (val === 1) await redis.expire(key, ttlSeconds);
    return val;
}

/**
 * Returns true if the model is within its RPM and RPD budgets.
 * Increments both counters optimistically — caller must handle 429 response.
 */
async function isWithinQuota(entry: PoolEntry): Promise<boolean> {
    const meta = getFreeModelMeta(entry.provider, entry.modelId);

    const rpmKey = RedisKeys.llmRpmQuota(entry.provider, entry.modelId);
    const currentRpm = await incrWithTtl(rpmKey, 60);
    if (meta?.rpm !== undefined && currentRpm > meta.rpm) return false;

    if (meta?.rpd !== null && meta?.rpd !== undefined) {
        const rpdKey = RedisKeys.llmRpdQuota(entry.provider, entry.modelId);
        const currentRpd = await incrWithTtl(rpdKey, secondsUntilMidnightUtc());
        if (currentRpd > meta.rpd) return false;
    }

    return true;
}

// ==============================================================================
// 2. CIRCUIT BREAKER HELPERS
// ==============================================================================

async function isCircuitOpen(provider: string, modelId: string): Promise<boolean> {
    const key = RedisKeys.llmCircuitBreaker(provider, modelId);
    const val = await redis.get<string>(key);
    return val === "OPEN";
}

async function recordFailure(provider: string, modelId: string): Promise<void> {
    const cbKey = RedisKeys.llmCircuitBreaker(provider, modelId);
    const failKey = `${cbKey}:failures`;
    const failures = await incrWithTtl(failKey, Math.ceil(CB_DEFAULTS.windowMs / 1000));
    if (failures >= CB_DEFAULTS.failureThreshold) {
        await redis.set(cbKey, "OPEN", { ex: Math.ceil(CB_DEFAULTS.openDurationMs / 1000) });
    }
}

async function recordSuccess(provider: string, modelId: string): Promise<void> {
    const cbKey = RedisKeys.llmCircuitBreaker(provider, modelId);
    await redis.del(cbKey, `${cbKey}:failures`);
}

// ==============================================================================
// 3. PROVIDER STREAM ADAPTERS
// ==============================================================================

/**
 * Generic OpenAI-compatible SSE parser.
 * Used by: Groq, SambaNova
 */
async function* parseOpenAiSse(body: ReadableStream<Uint8Array>): AsyncIterable<{ text: string }> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") return;
            try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) yield { text: content };
            } catch { /* partial chunk — ignore */ }
        }
    }
}

/**
 * Cohere v2 Chat SSE parser.
 * Event format: {"type":"content-delta","index":0,"delta":{"type":"text","text":"..."}}
 */
async function* parseCohereSSe(body: ReadableStream<Uint8Array>): AsyncIterable<{ text: string }> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            try {
                const parsed = JSON.parse(data);
                if (parsed.type === "content-delta") {
                    const text = parsed.delta?.text ?? parsed.delta?.message?.content?.[0]?.text;
                    if (text) yield { text };
                }
            } catch { /* partial chunk — ignore */ }
        }
    }
}

// ==============================================================================
// 4. INDIVIDUAL PROVIDER CALLERS
// ==============================================================================

async function streamGemini(
    modelId: string,
    messages: { role: string; content: string }[],
): Promise<AsyncIterable<{ text: string }>> {
    const client = new GoogleGenAI({ apiKey: getEnv("GOOGLE_API_KEY") });
    const prompt = messages.map(m => m.content).join("\n");
    const raw = await client.models.generateContentStream({ model: modelId, contents: prompt });

    async function* mapped() {
        for await (const chunk of raw) {
            if (chunk.text) yield { text: chunk.text };
        }
    }
    return mapped();
}

async function streamMistral(
    modelId: string,
    messages: { role: string; content: string }[],
): Promise<AsyncIterable<{ text: string }>> {
    const apiKey = getEnv("FREE_MISTRAL_API_KEY") || getEnv("GOOGLE_API_KEY"); // fallback handled by caller
    const { Mistral } = await import("npm:@mistralai/mistralai");
    const client = new Mistral({ apiKey });
    const raw = await client.chat.stream({ model: modelId, messages: messages as any });

    async function* mapped() {
        for await (const chunk of raw) {
            const content = chunk.data.choices?.[0]?.delta?.content;
            if (content) yield { text: content as string };
        }
    }
    return mapped();
}

async function streamGroq(
    modelId: string,
    messages: { role: string; content: string }[],
): Promise<AsyncIterable<{ text: string }>> {
    const apiKey = getEnv("GROQ_API_KEY");
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: modelId, messages, stream: true }),
    });
    if (!res.ok || !res.body) throw Object.assign(new Error("Groq error"), { status: res.status });
    return parseOpenAiSse(res.body);
}

async function streamSambanova(
    modelId: string,
    messages: { role: string; content: string }[],
): Promise<AsyncIterable<{ text: string }>> {
    const apiKey = getEnv("SAMBANOVA_API_KEY");
    const res = await fetch(`https://api.sambanova.ai/v1/chat/completions`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: modelId,
            messages,
            stream: true,
            stream_options: { include_usage: true },
        }),
    });
    if (!res.ok || !res.body) throw Object.assign(new Error("SambaNova error"), { status: res.status });
    return parseOpenAiSse(res.body);
}

async function streamCohere(
    modelId: string,
    messages: { role: string; content: string }[],
): Promise<AsyncIterable<{ text: string }>> {
    const apiKey = getEnv("COHERE_API_KEY");
    const res = await fetch("https://api.cohere.com/v2/chat", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        body: JSON.stringify({ model: modelId, messages, stream: true }),
    });
    if (!res.ok || !res.body) throw Object.assign(new Error("Cohere error"), { status: res.status });
    return parseCohereSSe(res.body);
}

// ==============================================================================
// 5. PROVIDER DISPATCHER
// ==============================================================================

async function callProvider(
    entry: PoolEntry,
    messages: { role: string; content: string }[],
): Promise<AsyncIterable<{ text: string }>> {
    switch (entry.provider) {
        case "gemini":    return streamGemini(entry.modelId, messages);
        case "mistral":   return streamMistral(entry.modelId, messages);
        case "groq":      return streamGroq(entry.modelId, messages);
        case "sambanova": return streamSambanova(entry.modelId, messages);
        case "cohere":    return streamCohere(entry.modelId, messages);
    }
}

// ==============================================================================
// 6. MAIN SERVICE
// ==============================================================================

export class FallbackLlmService {
    /**
     * Attempts to stream a response using the free provider rotation pool.
     * Automatically selects the tier based on estimated total prompt tokens,
     * then waterfalls through the priority-ordered pool until one succeeds.
     *
     * @param params.messages         Full message array (system + user + context)
     * @param params.estimatedTokens  Pre-computed token estimate for tier selection
     * @param params.logContext       Optional log context for structured logging
     */
    static async generateStream(params: {
        messages: { role: string; content: string }[];
        estimatedTokens?: number;
        logContext?: Record<string, any>;
    }): Promise<FallbackStreamResponse> {
        const { messages, logContext } = params;

        const fullText = messages.map(m => m.content).join(" ");
        const estimatedTokens = params.estimatedTokens ?? estimateTokenCount(fullText);
        const tier = selectTier(estimatedTokens);

        if (logContext) {
            logContext.fallbackTier = tier;
            logContext.estimatedTokens = estimatedTokens;
        }

        // Try non-emergency pool first, then emergency
        const pools: PoolEntry[][] = [
            [...getRotationPool(tier, false)],
            [...getRotationPool(tier, true).filter(e => e.emergency)],
        ];

        for (const pool of pools) {
            for (const entry of pool) {
                // Guard 1: Circuit breaker
                if (await isCircuitOpen(entry.provider, entry.modelId)) continue;

                // Guard 2: Quota
                const withinQuota = await isWithinQuota(entry);
                if (!withinQuota) continue;

                try {
                    const stream = await callProvider(entry, messages);
                    await recordSuccess(entry.provider, entry.modelId);

                    if (logContext) {
                        logContext.selectedProvider = entry.provider;
                        logContext.selectedModel    = entry.modelId;
                    }

                    return { stream, provider: entry.provider, modelId: entry.modelId };
                } catch (err: any) {
                    if (logContext) logContext[`${entry.provider}_error`] = err.message;
                    await recordFailure(entry.provider, entry.modelId);
                    // Continue to next candidate
                }
            }
        }

        throw new AppError({
            code: "PROVIDER_UNAVAILABLE",
            message: "All free LLM providers are currently quota-exhausted or unavailable. Please try again later.",
            status: 429,
        });
    }
}
