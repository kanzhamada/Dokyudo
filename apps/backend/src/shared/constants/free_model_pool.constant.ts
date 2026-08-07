/**
 * Free Model Rotation Pool — Tier Classification & Priority Ordering
 *
 * This file defines the ordered fallback rotation pools for the system-owned
 * free-tier RAG chat. It depends on `free_providers.constant.ts` for rate limit
 * metadata but does NOT import BYOK constants.
 *
 * Tier selection is driven by CONVERSATION HISTORY DEPTH, refined by a weighted
 * complexity score so depth-1/2 turns can float between tiers:
 *   depth 0            → LIGHT   (fresh conversation, no context)
 *   depth 1            → LIGHT or MEDIUM  (by complexity score)
 *   depth 2            → MEDIUM or HEAVY  (by complexity score)
 *   depth 3            → HEAVY   (deep context)
 *
 * Complexity score (reasoning load the model must carry):
 *   score = questionTokens + historyTokens + contextTokens * CONTEXT_WEIGHT
 *   - question + history get full weight (the model REASONS over them)
 *   - context is discounted (bounded by search, mostly "reading")
 *
 * Capability guards override everything, cheapest first:
 *   - totalTokens > 30K          → HEAVY (absolute ceiling)
 *   - contextTokens > 12K        → HEAVY (needs the big-context pools)
 *   - questionTokens > 200       → HEAVY (needs more reasoning capacity)
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
// 2. TIER SCORING & THRESHOLDS
// ==============================================================================

/**
 * Absolute ceiling for any free-tier prompt (total tokens). Above this the
 * request is forced to HEAVY (the caller may reject it outright).
 */
export const TIER_THRESHOLDS = {
    HEAVY_MAX: 30_000,
} as const;

/**
 * Capability guards — checked BEFORE the score (cheapest first). They protect
 * model capability regardless of the complexity score:
 *   - very long questions  → need more reasoning capacity
 *   - very large contexts  → need the big-context pools
 */
export const GUARD_THRESHOLDS = {
    /** Questions above this many tokens always go HEAVY (~800 chars). */
    QUESTION_HEAVY_MIN_TOKENS: 200,
    /** Retrieved context above this many tokens always goes HEAVY. */
    CONTEXT_HEAVY_MIN_TOKENS: 12_000,
} as const;

/**
 * Complexity score — the reasoning load the model must carry. Not all prompt
 * tokens cost the same:
 *   - question + history tokens get FULL weight (the model must reason over them)
 *   - context tokens get a discount (bounded by the search limit, mostly
 *     "reading" rather than reasoning — capability is still guarded separately)
 *
 *   score = questionTokens + historyTokens + contextTokens * CONTEXT_WEIGHT
 *
 * The score refines the depth boundaries:
 *   - depth 1: score ≤ DEPTH1_LIGHT_MAX stays LIGHT (tiny history + short Q)
 *   - depth 2: score ≤ DEPTH2_MEDIUM_MAX stays MEDIUM (above → HEAVY)
 */
export const TIER_SCORING = {
    /** Discount applied to context tokens in the score. */
    CONTEXT_WEIGHT: 0.1,
    /** Depth-1 score ceiling that still maps to LIGHT. */
    DEPTH1_LIGHT_MAX: 500,
    /** Depth-2 score ceiling that still maps to MEDIUM (above → HEAVY). */
    DEPTH2_MEDIUM_MAX: 1500,
} as const;

// ==============================================================================
// 3. ROTATION POOLS (ordered by priority — index 0 = highest priority)
// ==============================================================================

/**
 * LIGHT pool — optimize for RPM and RPD.
 * Best for: short questions / chit-chat (question ≤ 40 tokens).
 *
 * Priority rationale:
 * 1. Mistral ministral-3b  → 750 RPM — unmatched throughput, lightweight
 * 2. Mistral small-2506    → 300 RPM — strong throughput, mid quality
 * 3. Groq llama-3.1-8b    → 30 RPM, 14.4K RPD — best daily volume
 * 4. Mistral ministral-8b  → 188 RPM — solid mid model
 * 5. Groq llama-3.3-70b   → 30 RPM, highest quality in Groq free
 * 6. Gemini 3.1-flash-lite → 15 RPM, 500 RPD — best Gemini daily budget
 * 7. Cohere command-r7b    → 20 RPM — lightweight fallback
 */
export const LIGHT_POOL: readonly PoolEntry[] = [
    { provider: "mistral", modelId: "ministral-3b-2512" },
    { provider: "mistral", modelId: "mistral-small-2506" },
    { provider: "groq", modelId: "llama-3.1-8b-instant" },
    { provider: "mistral", modelId: "ministral-8b-2512" },
    { provider: "groq", modelId: "llama-3.3-70b-versatile" },
    { provider: "gemini", modelId: "gemini-3.1-flash-lite" },
    { provider: "cohere", modelId: "command-r7b-12-2024" },
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
 * 1. Gemini 3.1-flash-lite → 250K TPM — massive headroom, 500 RPD
 * 2. Mistral open-nemo     → 500K TPM, 128K ctx
 * 3. Mistral ministral-14b → 937K TPM, 131K ctx
 * 4. Groq llama-3.3-70b   → 12K TPM, highest quality
 * 5. Cohere command-r      → 128K ctx, unknown TPM
 * 6. Cohere command-a      → 256K ctx — largest Cohere context window
 */
export const MEDIUM_POOL: readonly PoolEntry[] = [
    { provider: "gemini", modelId: "gemini-3.1-flash-lite" },
    { provider: "mistral", modelId: "open-mistral-nemo" },
    { provider: "mistral", modelId: "ministral-14b-2512" },
    { provider: "groq", modelId: "llama-3.3-70b-versatile" },
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
 * 4. Mistral medium-2505   → 131K ctx, 375K TPM
 * 5. Cohere command-a      → 256K ctx — largest non-Gemini context
 * 6. SambaNova DeepSeek    → emergency, high quality for very long prompts
 */
export const HEAVY_POOL: readonly PoolEntry[] = [
    { provider: "gemini", modelId: "gemini-3.1-flash-lite" },
    { provider: "gemini", modelId: "gemini-2.5-flash" },
    { provider: "gemini", modelId: "gemini-3.5-flash" },
    { provider: "mistral", modelId: "mistral-medium-2505" },
    { provider: "cohere", modelId: "command-a-plus-05-2026" },
    { provider: "sambanova", modelId: "DeepSeek-V3.1", emergency: true },
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
 * Depth is the primary signal; a weighted complexity score refines the
 * depth-1 (LIGHT vs MEDIUM) and depth-2 (MEDIUM vs HEAVY) boundaries.
 * Capability guards (hard budget, context size, question length) override
 * everything. All inputs are pre-computed token estimates — the function is
 * O(1), no string work.
 *
 * @param params.historyDepth   - Number of previous (complete) turns in the prompt
 * @param params.questionTokens - Estimated tokens of the user question only
 * @param params.historyTokens  - Estimated tokens of the conversation history text
 * @param params.contextTokens  - Estimated tokens of retrieved document context
 * @param params.totalTokens    - Estimated tokens of the full prompt (all parts)
 */
export function selectTier(params: {
    historyDepth: number;
    questionTokens: number;
    historyTokens: number;
    contextTokens: number;
    totalTokens: number;
}): RotationTier {
    const {
        historyDepth,
        questionTokens,
        historyTokens,
        contextTokens,
        totalTokens,
    } = params;

    // Capability guards — checked first, cheapest to evaluate.
    if (totalTokens > TIER_THRESHOLDS.HEAVY_MAX) return "HEAVY";
    if (contextTokens > GUARD_THRESHOLDS.CONTEXT_HEAVY_MIN_TOKENS)
        return "HEAVY";
    if (questionTokens > GUARD_THRESHOLDS.QUESTION_HEAVY_MIN_TOKENS)
        return "HEAVY";

    // Complexity score — the reasoning load the model must carry.
    const score =
        questionTokens +
        historyTokens +
        contextTokens * TIER_SCORING.CONTEXT_WEIGHT;

    // Conversation depth is the primary signal; the score refines the
    // depth-1 (LIGHT vs MEDIUM) and depth-2 (MEDIUM vs HEAVY) boundaries.
    switch (historyDepth) {
        case 0:
            return "LIGHT";
        case 1:
            return score <= TIER_SCORING.DEPTH1_LIGHT_MAX ? "LIGHT" : "MEDIUM";
        case 2:
            return score <= TIER_SCORING.DEPTH2_MEDIUM_MAX ? "MEDIUM" : "HEAVY";
        default:
            return "HEAVY";
    }
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
