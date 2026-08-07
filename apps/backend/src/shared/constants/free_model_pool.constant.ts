/**
 * Free Model Rotation Pool — Tier Classification & Priority Ordering
 *
 * This file defines the ordered fallback rotation pools for the system-owned
 * free-tier RAG chat. It depends on `free_providers.constant.ts` for rate limit
 * metadata but does NOT import BYOK constants.
 *
 * Tier selection is driven by the CONVERSATION HISTORY DEPTH (number of previous
 * turns carried into the prompt) — the strongest real signal, since the RAG
 * context is bounded by the search limit and therefore near-constant:
 *   LIGHT  → 0 previous turns (fresh conversation)
 *   MEDIUM → 1–2 previous turns
 *   HEAVY  → 3 previous turns (deep context)
 *
 * Three guards override the depth-based classification:
 *   - questionTokens > 200    → HEAVY (very long questions need more capacity)
 *   - contextTokens > 12K     → HEAVY (large prompts need the big-context pools)
 *   - totalTokens > 30K       → HEAVY (absolute ceiling — never route past it)
 *
 * Within each tier, models are ordered by a composite priority score:
 *   Primary:   RPM (sustain high concurrency)
 *   Secondary: RPD (sustain high daily volume)
 *   Tertiary:  Quality / model size
 *
 * Models tagged `emergency: true` are only used when ALL other models in
 * the tier (and all fallback tiers) are quota-exhausted. This applies to
 * SambaNova models which have only 20 RPD.
 */

import type { FreeProvider } from "./free_providers.constant.ts";

// ==============================================================================
// 1. TYPES
// ==============================================================================

export type RotationTier = "LIGHT" | "MEDIUM" | "HEAVY";

export interface PoolEntry {
    /** Provider name, used as Redis key segment and SDK router key */
    readonly provider: FreeProvider;
    /** Exact model ID string as expected by the provider's API */
    readonly modelId: string;
    /**
     * If true, this model is only selected after ALL non-emergency models
     * in the current tier AND all lower-priority tiers are exhausted.
     */
    readonly emergency?: true;
}

// ==============================================================================
// 2. TOKEN & DEPTH THRESHOLDS
// ==============================================================================

/**
 * Absolute ceiling for any free-tier prompt (total tokens). Above this the
 * request is forced to HEAVY (the caller may reject it outright).
 */
export const TIER_THRESHOLDS = {
    HEAVY_MAX: 30_000,
} as const;

/**
 * Question-length threshold (tokens): questions above this are always routed
 * to HEAVY — they need more reasoning capacity regardless of conversation
 * depth. (~800 characters at the 1-token-per-4-chars rule of thumb.)
 */
export const QUESTION_HEAVY_MIN_TOKENS = 200;

/**
 * Conversation-depth thresholds — the PRIMARY classification signal.
 *
 * Why history-based instead of total-prompt-based: the RAG context is bounded
 * by the search limit (fixed top-K chunks), so the retrieved-document part is
 * near-constant. The only variables that actually move the prompt size are the
 * conversation history (0–3 previous turns) and the question. Deeper history
 * means the model must carry and reconcile more prior Q&A, so it drives the tier:
 *   0 previous turns (fresh conversation) → LIGHT
 *   1–2 previous turns                    → MEDIUM
 *   3 previous turns                      → HEAVY
 */
export const HISTORY_DEPTH_THRESHOLDS = {
    /** Max history depth that still maps to MEDIUM (above this → HEAVY). */
    MEDIUM_MAX_DEPTH: 2,
} as const;

/**
 * Context guard: when the retrieved document context alone exceeds this many
 * tokens, route to HEAVY regardless of question length or history depth.
 */
export const CONTEXT_HEAVY_MIN_TOKENS = 12_000;

// ==============================================================================
// 3. ROTATION POOLS (ordered by priority — index 0 = highest priority)
// ==============================================================================

/**
 * LIGHT pool — optimize for RPM and RPD.
 * Best for: short questions / chit-chat (question ≤ 40 tokens).
 *
 * Priority rationale:
 * 1. Mistral ministral-3b  → 750 RPM — unmatched throughput, lightweight
 * 2. Groq qwen3-32b        → 60 RPM, 1K RPD — highest quality at high RPM
 * 3. Mistral small-2506    → 300 RPM — strong throughput, mid quality
 * 4. Groq llama-3.1-8b    → 30 RPM, 14.4K RPD — best daily volume
 * 5. Mistral ministral-8b  → 188 RPM — solid mid model
 * 6. Groq llama-4-scout    → 30 RPM, high quality, 30K TPM headroom
 * 7. Groq llama-3.3-70b   → 30 RPM, highest quality in Groq free
 * 8. Gemini 3.1-flash-lite → 15 RPM, 500 RPD — best Gemini daily budget
 * 9. Cohere command-r7b    → 20 RPM — lightweight fallback
 */
export const LIGHT_POOL: readonly PoolEntry[] = [
    { provider: "mistral", modelId: "ministral-3b-2512" },
    { provider: "groq", modelId: "qwen/qwen3-32b" },
    { provider: "mistral", modelId: "mistral-small-2506" },
    { provider: "groq", modelId: "llama-3.1-8b-instant" },
    { provider: "mistral", modelId: "ministral-8b-2512" },
    { provider: "groq", modelId: "meta-llama/llama-4-scout-17b-16e-instruct" },
    { provider: "groq", modelId: "llama-3.3-70b-versatile" },
    { provider: "gemini", modelId: "gemini-3.1-flash-lite" },
    { provider: "cohere", modelId: "command-r7b-12-2024" },
    { provider: "groq", modelId: "qwen/qwen3.6-27b" },
    {
        provider: "sambanova",
        modelId: "Meta-Llama-3.3-70B-Instruct",
        emergency: true,
    },
    { provider: "sambanova", modelId: "DeepSeek-V3.1", emergency: true },
] as const;

/**
 * MEDIUM pool — balance TPM headroom with quality.
 * Best for: standard questions (40–200 tokens).
 *
 * Priority rationale:
 * 1. Groq llama-4-scout    → 30K TPM — highest TPM in Groq free
 * 2. Gemini 3.1-flash-lite → 250K TPM — massive headroom, 500 RPD
 * 3. Mistral open-nemo     → 500K TPM, 128K ctx
 * 4. Mistral ministral-14b → 937K TPM, 131K ctx
 * 5. Groq llama-3.3-70b   → 12K TPM, highest quality
 * 6. Groq gpt-oss-120b     → 8K TPM, 200K TPD
 * 7. Gemini 2.5-flash-lite → 250K TPM, 20 RPD (limited)
 * 8. Cohere command-r      → 128K ctx, unknown TPM
 * 9. Cohere command-a      → 256K ctx — largest Cohere context window
 */
export const MEDIUM_POOL: readonly PoolEntry[] = [
    { provider: "groq", modelId: "meta-llama/llama-4-scout-17b-16e-instruct" },
    { provider: "gemini", modelId: "gemini-3.1-flash-lite" },
    { provider: "mistral", modelId: "open-mistral-nemo" },
    { provider: "mistral", modelId: "ministral-14b-2512" },
    { provider: "groq", modelId: "llama-3.3-70b-versatile" },
    { provider: "groq", modelId: "openai/gpt-oss-120b" },
    { provider: "cohere", modelId: "command-r-08-2024" },
    { provider: "cohere", modelId: "command-a-03-2025" },
    { provider: "mistral", modelId: "mistral-medium-2505" },
    {
        provider: "sambanova",
        modelId: "Meta-Llama-3.3-70B-Instruct",
        emergency: true,
    },
    { provider: "sambanova", modelId: "DeepSeek-V3.1", emergency: true },
] as const;

/**
 * HEAVY pool — maximize context window and TPM.
 * Best for: long/complex questions (> 200 tokens) or contexts > 12K tokens.
 *
 * Priority rationale:
 * 1. Gemini 3.1-flash-lite → 1M ctx, 250K TPM, 500 RPD — best daily budget
 * 2. Gemini 2.5-flash      → 1M ctx, 250K TPM — highest quality Gemini free
 * 3. Gemini 3.5-flash      → 1M ctx, 250K TPM
 * 4. Gemini 3-flash        → 1M ctx, 250K TPM
 * 5. Gemini 2.5-flash-lite → 1M ctx, 250K TPM (20 RPD — careful)
 * 6. Mistral medium-2505   → 131K ctx, 375K TPM
 * 7. Groq groq/compound-mini → 70K TPM, 128K ctx
 * 8. Cohere command-a      → 256K ctx — largest non-Gemini context
 * 9. SambaNova DeepSeek    → emergency, high quality for very long prompts
 */
export const HEAVY_POOL: readonly PoolEntry[] = [
    { provider: "gemini",    modelId: "gemini-3.1-flash-lite" },
    { provider: "gemini",    modelId: "gemini-2.5-flash" },
    { provider: "gemini",    modelId: "gemini-3.5-flash" },
    { provider: "mistral",   modelId: "mistral-medium-2505" },
    { provider: "groq",      modelId: "groq/compound-mini" },
    { provider: "cohere",    modelId: "command-a-plus-05-2026" },
    { provider: "sambanova", modelId: "DeepSeek-V3.1", emergency: true },
    { provider: "sambanova", modelId: "gpt-oss-120b", emergency: true },
] as const;

export const ROTATION_POOLS = {
    LIGHT: LIGHT_POOL,
    MEDIUM: MEDIUM_POOL,
    HEAVY: HEAVY_POOL,
} as const satisfies Record<RotationTier, readonly PoolEntry[]>;

// ==============================================================================
// 4. HELPER UTILITIES
// ==============================================================================

/**
 * Selects the appropriate rotation tier.
 *
 * Classification is driven by conversation history depth (the strongest real
 * signal), with guards that force HEAVY for very long questions, very large
 * contexts, or prompts over the hard budget. All inputs are pre-computed token
 * estimates — the function itself is O(1).
 *
 * @param params.historyDepth   - Number of previous turns carried in the prompt
 * @param params.questionTokens - Estimated tokens of the user question only
 * @param params.contextTokens  - Estimated tokens of retrieved document context
 * @param params.totalTokens    - Estimated tokens of the full prompt (all parts)
 */
export function selectTier(params: {
    historyDepth: number;
    questionTokens: number;
    contextTokens: number;
    totalTokens: number;
}): RotationTier {
    const { historyDepth, questionTokens, contextTokens, totalTokens } = params;

    // Guards (safety) — checked first, cheapest to evaluate.
    // Hard budget: never route a prompt past the free tier's ceiling.
    if (totalTokens > TIER_THRESHOLDS.HEAVY_MAX) return "HEAVY";
    // Very large retrieved context needs the big-context pools.
    if (contextTokens > CONTEXT_HEAVY_MIN_TOKENS) return "HEAVY";
    // Very long questions need more reasoning capacity regardless of depth.
    if (questionTokens > QUESTION_HEAVY_MIN_TOKENS) return "HEAVY";

    // Primary signal: conversation history depth.
    if (historyDepth === 0) return "LIGHT";
    if (historyDepth <= HISTORY_DEPTH_THRESHOLDS.MEDIUM_MAX_DEPTH) return "MEDIUM";
    return "HEAVY";
}

/**
 * Returns the ordered pool entries for a given tier, optionally filtering
 * out emergency models (use during normal operation; include during exhaustion).
 *
 * @param tier             - Target tier
 * @param includeEmergency - Set true only when all non-emergency models are exhausted
 */
export function getRotationPool(
    tier: RotationTier,
    includeEmergency = false,
): readonly PoolEntry[] {
    const pool = ROTATION_POOLS[tier];
    if (includeEmergency) return pool;
    return pool.filter((entry) => !entry.emergency);
}

/**
 * Estimates token count from a raw string.
 * Rule of thumb: 1 token ≈ 4 characters (works across English and Bahasa Indonesia).
 * Use this for quick pre-flight token estimation before hitting the LLM.
 */
export function estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
}
