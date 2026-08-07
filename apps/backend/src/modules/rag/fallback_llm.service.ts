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
 * Reads a fetch Response body and extracts the API's error message (JSON
 * `error.message` first, raw text fallback) for fetch-based providers.
 */
async function extractApiError(res: Response): Promise<string> {
    const raw = await res.text().catch(() => "");
    if (!raw) return "empty error body";
    try {
        const parsed = JSON.parse(raw);
        const msg = parsed?.error?.message ?? parsed?.message ?? raw;
        return String(msg).slice(0, 250);
    } catch {
        return raw.slice(0, 250);
    }
}

/**
 * Normalizes a provider error into a short, auditable message regardless of
 * source: fetch-based providers (Groq/SambaNova/Cohere) enrich their error
 * with an HTTP status + API body at throw time; SDK-based providers
 * (Gemini/Mistral) carry their native error message.
 */
function providerErrorMessage(err: unknown): string {
    const e = err as any;
    if (e?.name === "AbortError") return "aborted";
    const status = typeof e?.status === "number" ? e.status : undefined;
    const msg = typeof e?.message === "string" && e.message.length > 0
        ? e.message
        : String(e ?? "unknown provider error");
    const trimmed = msg.slice(0, 300);
    return status ? `[${status}] ${trimmed}` : trimmed;
}

/**
 * Generic OpenAI-compatible SSE parser.
 * Used by: Groq, SambaNova
 */
async function* parseOpenAiSse(
    body: ReadableStream<Uint8Array>,
    signal?: AbortSignal,
): AsyncIterable<{ text: string }> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        if (signal?.aborted) return;
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
            if (signal?.aborted) return;
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
async function* parseCohereSSe(
    body: ReadableStream<Uint8Array>,
    signal?: AbortSignal,
): AsyncIterable<{ text: string }> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        if (signal?.aborted) return;
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
            if (signal?.aborted) return;
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            // Handle both SSE (data: {...}) and NDJSON ({...})
            const dataStr = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
            if (dataStr === "[DONE]") continue;

            try {
                const parsed = JSON.parse(dataStr);
                if (parsed.type === "content-delta") {
                    const text = parsed.delta?.text ?? parsed.delta?.message?.content?.text;
                    // Note: We ignore parsed.delta?.message?.content?.thinking
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
    signal?: AbortSignal,
): Promise<AsyncIterable<{ text: string }>> {
    const client = new GoogleGenAI({ apiKey: getEnv("GOOGLE_API_KEY") });
    const prompt = messages.map(m => m.content).join("\n");
    const raw = await client.models.generateContentStream({
        model: modelId,
        contents: prompt,
        config: { abortSignal: signal },
    });

    async function* mapped() {
        for await (const chunk of raw) {
            if (signal?.aborted) break;
            if (chunk.text) yield { text: chunk.text };
        }
    }
    return mapped();
}

async function streamMistral(
    modelId: string,
    messages: { role: string; content: string }[],
    signal?: AbortSignal,
): Promise<AsyncIterable<{ text: string }>> {
    const apiKey = getEnv("FREE_MISTRAL_API_KEY") || getEnv("GOOGLE_API_KEY"); // fallback handled by caller
    const { Mistral } = await import("npm:@mistralai/mistralai");
    const client = new Mistral({ apiKey });
    const raw = await client.chat.stream({ model: modelId, messages: messages as any });

    async function* mapped() {
        for await (const chunk of raw) {
            if (signal?.aborted) break;
            const content = chunk.data.choices?.[0]?.delta?.content;
            if (content) yield { text: content as string };
        }
    }
    return mapped();
}

async function streamGroq(
    modelId: string,
    messages: { role: string; content: string }[],
    signal?: AbortSignal,
): Promise<AsyncIterable<{ text: string }>> {
    const apiKey = getEnv("GROQ_API_KEY");
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: modelId, messages, stream: true }),
        signal,
    });
    if (!res.ok || !res.body) {
        throw Object.assign(
            new Error(`Groq ${res.status}: ${await extractApiError(res)}`),
            { status: res.status },
        );
    }
    
    // Some models (like Qwen) return <think> tags. We strip them from the stream.
    async function* stripThinkTags(source: AsyncIterable<{ text: string }>) {
        let insideThink = false;
        let buffer = "";
        
        for await (const chunk of source) {
            buffer += chunk.text;
            
            while (buffer.length > 0) {
                if (!insideThink) {
                    const startIdx = buffer.indexOf("<think>");
                    if (startIdx === -1) {
                        // Check if we might be matching a partial tag at the end
                        const possiblePartial = buffer.lastIndexOf("<");
                        if (possiblePartial !== -1 && "<think>".startsWith(buffer.slice(possiblePartial))) {
                            // Yield up to the partial match and wait for more
                            if (possiblePartial > 0) {
                                yield { text: buffer.slice(0, possiblePartial) };
                                buffer = buffer.slice(possiblePartial);
                            }
                            break; 
                        } else {
                            // Safe to yield all
                            yield { text: buffer };
                            buffer = "";
                        }
                    } else {
                        // Found a think tag
                        if (startIdx > 0) {
                            yield { text: buffer.slice(0, startIdx) };
                        }
                        buffer = buffer.slice(startIdx + 7); // Skip <think>
                        insideThink = true;
                    }
                } else {
                    const endIdx = buffer.indexOf("</think>");
                    if (endIdx === -1) {
                        // Consume buffer entirely since we are inside a think block
                        buffer = "";
                        break;
                    } else {
                        buffer = buffer.slice(endIdx + 8); // Skip </think>
                        // Also skip a leading newline if one immediately follows the think block closing
                        if (buffer.startsWith("\n")) {
                            buffer = buffer.slice(1);
                        }
                        insideThink = false;
                    }
                }
            }
        }
        
        if (buffer.length > 0 && !insideThink) {
             yield { text: buffer };
        }
    }

    return stripThinkTags(parseOpenAiSse(res.body, signal));
}

async function streamSambanova(
    modelId: string,
    messages: { role: string; content: string }[],
    signal?: AbortSignal,
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
        signal,
    });
    if (!res.ok || !res.body) {
        throw Object.assign(
            new Error(`SambaNova ${res.status}: ${await extractApiError(res)}`),
            { status: res.status },
        );
    }
    return parseOpenAiSse(res.body, signal);
}

async function streamCohere(
    modelId: string,
    messages: { role: string; content: string }[],
    signal?: AbortSignal,
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
        signal,
    });
    if (!res.ok || !res.body) {
        throw Object.assign(
            new Error(`Cohere ${res.status}: ${await extractApiError(res)}`),
            { status: res.status },
        );
    }
    return parseCohereSSe(res.body, signal);
}

// ==============================================================================
// 5. PROVIDER DISPATCHER
// ==============================================================================

async function callProvider(
    entry: PoolEntry,
    messages: { role: string; content: string }[],
    signal?: AbortSignal,
): Promise<AsyncIterable<{ text: string }>> {
    switch (entry.provider) {
        case "gemini":    return streamGemini(entry.modelId, messages, signal);
        case "mistral":   return streamMistral(entry.modelId, messages, signal);
        case "groq":      return streamGroq(entry.modelId, messages, signal);
        case "sambanova": return streamSambanova(entry.modelId, messages, signal);
        case "cohere":    return streamCohere(entry.modelId, messages, signal);
    }
}

// ==============================================================================
// 6. MAIN SERVICE
// ==============================================================================

async function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    signal?: AbortSignal,
): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("TIMEOUT")), ms);
    });
    const aborted = new Promise<never>((_, reject) => {
        if (!signal) return;
        onAbort = () => reject(signal.reason ?? new DOMException("The operation was aborted", "AbortError"));
        if (signal.aborted) onAbort();
        else signal.addEventListener("abort", onAbort, { once: true });
    });

    return Promise.race([promise, timeout, aborted]).finally(() => {
        if (timer) clearTimeout(timer);
        if (signal && onAbort) signal.removeEventListener("abort", onAbort);
    });
}

export class FallbackLlmService {
    /**
     * Attempts to stream a response using the free provider rotation pool.
     * Selects the tier from the user question's token count (see
     * `selectTier`), then waterfalls through the priority-ordered pool until
     * one succeeds.
     *
     * @param params.messages         Full message array (system + user + context)
     * @param params.estimatedTokens  Pre-computed total prompt token estimate
     * @param params.historyDepth     Number of previous turns carried in the prompt
     * @param params.questionTokens   Estimated tokens of the user question only
     * @param params.historyTokens    Estimated tokens of the conversation history text
     * @param params.contextTokens    Estimated tokens of retrieved document context
     * @param params.logContext       Optional log context for structured logging
     */
    static async generateStream(params: {
        messages: { role: string; content: string }[];
        estimatedTokens?: number;
        historyDepth?: number;
        questionTokens?: number;
        historyTokens?: number;
        contextTokens?: number;
        signal?: AbortSignal;
        logContext?: Record<string, any>;
    }): Promise<FallbackStreamResponse> {
        const { messages, signal, logContext } = params;

        const fullText = messages.map(m => m.content).join(" ");
        const totalTokens = params.estimatedTokens ?? estimateTokenCount(fullText);
        const historyDepth = params.historyDepth ?? 0;
        const questionTokens = params.questionTokens ?? estimateTokenCount(messages[messages.length - 1]?.content ?? "");
        const historyTokens = params.historyTokens ?? 0;
        const contextTokens = params.contextTokens ?? totalTokens;
        const tier = selectTier({ historyDepth, questionTokens, historyTokens, contextTokens, totalTokens });

        if (logContext) {
            logContext.fallbackTier = tier;
            logContext.estimatedTokens = totalTokens;
            logContext.historyDepth = historyDepth;
            logContext.estimatedQuestionTokens = questionTokens;
            logContext.estimatedHistoryTokens = historyTokens;
            logContext.estimatedContextTokens = contextTokens;
        }

        // Try non-emergency pool first, then emergency
        const pools: PoolEntry[][] = [
            [...getRotationPool(tier, false)],
            [...getRotationPool(tier, true).filter(e => e.emergency)],
        ];

        // Ordered fallback chain — every candidate tried, ending with the one
        // that succeeded (persisted as model_used) or the last failure.
        const fallbackChain: {
            provider: FreeProvider;
            modelId: string;
            outcome: "circuit_open" | "quota_exhausted" | "failed" | "success";
            error?: string;
        }[] = [];

        for (const pool of pools) {
            for (const entry of pool) {
                if (signal?.aborted) {
                    throw signal.reason ?? new DOMException("The operation was aborted", "AbortError");
                }

                // Guard 1: Circuit breaker
                if (await isCircuitOpen(entry.provider, entry.modelId)) {
                    fallbackChain.push({
                        provider: entry.provider,
                        modelId: entry.modelId,
                        outcome: "circuit_open",
                    });
                    continue;
                }

                // Guard 2: Quota
                const withinQuota = await isWithinQuota(entry);
                if (!withinQuota) {
                    fallbackChain.push({
                        provider: entry.provider,
                        modelId: entry.modelId,
                        outcome: "quota_exhausted",
                    });
                    continue;
                }

                try {
                    // Enforce 15-second connection timeout (Time-To-First-Token)
                    const stream = await withTimeout(callProvider(entry, messages, signal), 15_000, signal);
                    if (signal?.aborted) {
                        throw signal.reason ?? new DOMException("The operation was aborted", "AbortError");
                    }
                    await recordSuccess(entry.provider, entry.modelId);
                    fallbackChain.push({
                        provider: entry.provider,
                        modelId: entry.modelId,
                        outcome: "success",
                    });

                    if (logContext) {
                        logContext.fallbackChain = fallbackChain;
                    }

                    return { stream, provider: entry.provider, modelId: entry.modelId };
                } catch (err: any) {
                    if (signal?.aborted || err?.name === "AbortError") throw err;
                    await recordFailure(entry.provider, entry.modelId);
                    fallbackChain.push({
                        provider: entry.provider,
                        modelId: entry.modelId,
                        outcome: "failed",
                        error: providerErrorMessage(err),
                    });
                    // Continue to next candidate
                }
            }
        }

        // All candidates exhausted — expose the full chain in the log for debugging.
        if (logContext) logContext.fallbackChain = fallbackChain;

        throw new AppError({
            code: "PROVIDER_UNAVAILABLE",
            message: "All free LLM providers are currently quota-exhausted or unavailable. Please try again later.",
            status: 429,
        });
    }
}
