/**
 * Free Model Rotation Pool — Tier Classification & Priority Ordering
 *
 * This file defines the ordered fallback rotation pools for the system-owned
 * free-tier RAG chat. It depends on `free_providers.constant.ts` for rate limit
 * metadata but does NOT import BYOK constants.
 *
 * Tier selection is based on estimated total prompt tokens:
 *   LIGHT  → < 4K tokens   (user query + small doc context)
 *   MEDIUM → 4K–12K tokens  (user query + multiple chunks)
 *   HEAVY  → 12K–30K tokens (user query + many/large documents)
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
// 2. TOKEN THRESHOLDS
// ==============================================================================

export const TIER_THRESHOLDS = {
    /** Max tokens for LIGHT tier. Above this → MEDIUM. */
    LIGHT_MAX: 4_000,
    /** Max tokens for MEDIUM tier. Above this → HEAVY. */
    MEDIUM_MAX: 12_000,
    /** Max tokens for HEAVY tier. Above this → reject or use emergency. */
    HEAVY_MAX: 30_000,
} as const;

// ==============================================================================
// 3. ROTATION POOLS (ordered by priority — index 0 = highest priority)
// ==============================================================================

/**
 * LIGHT pool — optimize for RPM and RPD.
 * Best for: short queries + small document context (< 4K tokens).
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
    { provider: "cohere", modelId: "command-r7b" },
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
 * Best for: standard queries + multiple document chunks (4K–12K tokens).
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
    { provider: "gemini", modelId: "gemini-2.5-flash-lite" },
    { provider: "cohere", modelId: "command-r" },
    { provider: "cohere", modelId: "command-a" },
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
 * Best for: large document sets (12K–30K tokens).
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
    { provider: "gemini", modelId: "gemini-3.1-flash-lite" },
    { provider: "gemini", modelId: "gemini-2.5-flash" },
    { provider: "gemini", modelId: "gemini-3.5-flash" },
    { provider: "gemini", modelId: "gemini-3-flash" },
    { provider: "gemini", modelId: "gemini-2.5-flash-lite" },
    { provider: "mistral", modelId: "mistral-medium-2505" },
    { provider: "groq", modelId: "groq/compound-mini" },
    { provider: "cohere", modelId: "command-a" },
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
 * Selects the appropriate rotation tier based on estimated total prompt tokens.
 * Call this before routing to the LLM to determine which pool to iterate.
 *
 * @param estimatedTokens - Total tokens including system prompt + user query + doc context
 */
export function selectTier(estimatedTokens: number): RotationTier {
    if (estimatedTokens <= TIER_THRESHOLDS.LIGHT_MAX) return "LIGHT";
    if (estimatedTokens <= TIER_THRESHOLDS.MEDIUM_MAX) return "MEDIUM";
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
