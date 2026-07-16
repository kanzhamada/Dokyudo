/**
 * Free Provider Model Registry — System-Owned Fallback Pool
 *
 * IMPORTANT: This file is NOT related to BYOK (Bring Your Own Key).
 * These are providers whose API keys are owned by the Dokyudo system and
 * are used exclusively for the free-tier RAG chat fallback rotation.
 *
 * Excluded from each provider:
 * - Embedding models (handled by Upstash Vector pipeline)
 * - Audio/TTS/STT models (whisper, voxtral, orpheus)
 * - Moderation/safeguard/prompt-guard models
 * - Coding-specific models (codestral, devstral)
 *
 * Rate limit metadata is embedded per model to support the weighted
 * round-robin rotation strategy with Redis quota tracking.
 */

// ==============================================================================
// 1. TYPES
// ==============================================================================

export type FreeProvider =
    "gemini" | "groq" | "mistral" | "sambanova" | "cohere";

/**
 * Rate limit metadata per model.
 * All nullable fields mean "unknown/unlimited" for that provider's free tier.
 * - rpm: Requests Per Minute
 * - rpd: Requests Per Day (null = not documented / unlimited)
 * - tpm: Tokens Per Minute (null = not documented)
 * - tpd: Tokens Per Day (null = not documented / unlimited)
 */
interface FreeModelMeta {
    readonly modelId: string;
    readonly rpm: number;
    readonly rpd: number | null;
    readonly tpm: number | null;
    readonly tpd: number | null;
    /** Approximate max context window in tokens */
    readonly contextWindow: number;
}

// ==============================================================================
// 2. MODEL REGISTRIES PER FREE PROVIDER
// ==============================================================================

/** Gemini free tier — only confirmed working models from smoke test */
export const FREE_GEMINI_MODELS = [
    // ✅ ALIVE (smoke test 2026-07-16)
    { modelId: "gemini-2.5-flash",      rpm: 5,   rpd: 20,  tpm: 250_000, tpd: null, contextWindow: 1_048_576 },
    { modelId: "gemini-3.1-flash-lite", rpm: 15,  rpd: 500, tpm: 250_000, tpd: null, contextWindow: 1_048_576 },
    // ⏱️ Kept as fallback, but prone to timeout when overloaded
    { modelId: "gemini-3.5-flash",      rpm: 5,   rpd: 20,  tpm: 250_000, tpd: null, contextWindow: 1_048_576 },
] as const satisfies readonly FreeModelMeta[];

/** Groq free tier — notable for very high RPM and throughput */
export const FREE_GROQ_MODELS = [
    {
        modelId: "qwen/qwen3-32b",
        rpm: 60,
        rpd: 1_000,
        tpm: 6_000,
        tpd: 500_000,
        contextWindow: 32_768,
    },
    {
        modelId: "llama-3.1-8b-instant",
        rpm: 30,
        rpd: 14_400,
        tpm: 6_000,
        tpd: 500_000,
        contextWindow: 131_072,
    },
    {
        modelId: "meta-llama/llama-4-scout-17b-16e-instruct",
        rpm: 30,
        rpd: 1_000,
        tpm: 30_000,
        tpd: 500_000,
        contextWindow: 131_072,
    },
    {
        modelId: "llama-3.3-70b-versatile",
        rpm: 30,
        rpd: 1_000,
        tpm: 12_000,
        tpd: 100_000,
        contextWindow: 131_072,
    },
    {
        modelId: "openai/gpt-oss-120b",
        rpm: 30,
        rpd: 1_000,
        tpm: 8_000,
        tpd: 200_000,
        contextWindow: 128_000,
    },
    {
        modelId: "openai/gpt-oss-20b",
        rpm: 30,
        rpd: 1_000,
        tpm: 8_000,
        tpd: 200_000,
        contextWindow: 128_000,
    },
    {
        modelId: "groq/compound-mini",
        rpm: 30,
        rpd: 250,
        tpm: 70_000,
        tpd: null,
        contextWindow: 128_000,
    },
    {
        modelId: "qwen/qwen3.6-27b",
        rpm: 30,
        rpd: 1_000,
        tpm: 8_000,
        tpd: 200_000,
        contextWindow: 32_768,
    },
] as const satisfies readonly FreeModelMeta[];

/** Mistral free tier — open-mistral-nemo excluded (capacity exceeded in smoke test) */
export const FREE_MISTRAL_MODELS = [
    // ✅ ALIVE (smoke test 2026-07-16)
    { modelId: "ministral-3b-2512",   rpm: 750, rpd: null, tpm: 1_300_000, tpd: null, contextWindow: 32_768  },
    { modelId: "mistral-small-2506",  rpm: 300, rpd: null, tpm: 2_250_000, tpd: null, contextWindow: 32_768  },
    { modelId: "ministral-8b-2512",   rpm: 188, rpd: null, tpm: 625_000,   tpd: null, contextWindow: 131_072 },
    { modelId: "ministral-14b-2512",  rpm: 30,  rpd: null, tpm: 937_500,   tpd: null, contextWindow: 131_072 },
    { modelId: "mistral-medium-2505", rpm: 25,  rpd: null, tpm: 375_000,   tpd: null, contextWindow: 131_072 },
    // ⚠️  RATE-LIMITED (capacity exceeded): open-mistral-nemo — kept as last-resort
    { modelId: "open-mistral-nemo",   rpm: 30,  rpd: null, tpm: 500_000,   tpd: null, contextWindow: 128_000 },
] as const satisfies readonly FreeModelMeta[];

/**
 * SambaNova free tier — very high quality models but extremely low RPD (20/day).
 * Treat as last-resort emergency fallback only.
 */
export const FREE_SAMBANOVA_MODELS = [
    {
        modelId: "DeepSeek-V3.1",
        rpm: 20,
        rpd: 20,
        tpm: null,
        tpd: 200_000,
        contextWindow: 64_000,
    },
    {
        modelId: "Meta-Llama-3.3-70B-Instruct",
        rpm: 20,
        rpd: 20,
        tpm: null,
        tpd: 200_000,
        contextWindow: 131_072,
    },
    {
        modelId: "gpt-oss-120b",
        rpm: 20,
        rpd: 20,
        tpm: null,
        tpd: 200_000,
        contextWindow: 128_000,
    },
] as const satisfies readonly FreeModelMeta[];

/** Cohere trial tier — versioned model IDs required (smoke test 2026-07-16) */
export const FREE_COHERE_MODELS = [
    // ✅ Use versioned IDs — unversioned aliases are deprecated / removed
    { modelId: "command-a-plus-05-2026", rpm: 20, rpd: null, tpm: null, tpd: null, contextWindow: 128_000 },
    { modelId: "command-a-03-2025",      rpm: 20, rpd: null, tpm: null, tpd: null, contextWindow: 256_000 },
    { modelId: "command-r-plus-08-2024", rpm: 20, rpd: null, tpm: null, tpd: null, contextWindow: 128_000 },
    { modelId: "command-r-08-2024",      rpm: 20, rpd: null, tpm: null, tpd: null, contextWindow: 128_000 },
    { modelId: "command-r7b-12-2024",    rpm: 20, rpd: null, tpm: null, tpd: null, contextWindow: 128_000 },
] as const satisfies readonly FreeModelMeta[];

// ==============================================================================
// 3. MASTER REGISTRY
// ==============================================================================

export const FREE_PROVIDER_MODELS = {
    gemini: FREE_GEMINI_MODELS,
    groq: FREE_GROQ_MODELS,
    mistral: FREE_MISTRAL_MODELS,
    sambanova: FREE_SAMBANOVA_MODELS,
    cohere: FREE_COHERE_MODELS,
} as const satisfies Record<FreeProvider, readonly FreeModelMeta[]>;

// ==============================================================================
// 4. INFERRED TYPES (derived from registry — no duplication)
// ==============================================================================

export type FreeGeminiModelId = (typeof FREE_GEMINI_MODELS)[number]["modelId"];
export type FreeGroqModelId = (typeof FREE_GROQ_MODELS)[number]["modelId"];
export type FreeMistralModelId =
    (typeof FREE_MISTRAL_MODELS)[number]["modelId"];
export type FreeSambanovaModelId =
    (typeof FREE_SAMBANOVA_MODELS)[number]["modelId"];
export type FreeCohereModelId = (typeof FREE_COHERE_MODELS)[number]["modelId"];

/** Union of all free model IDs across all system-owned providers */
export type FreeModelId =
    | FreeGeminiModelId
    | FreeGroqModelId
    | FreeMistralModelId
    | FreeSambanovaModelId
    | FreeCohereModelId;

// ==============================================================================
// 5. HELPER UTILITIES
// ==============================================================================

/**
 * Retrieve the metadata object for a given provider + model combination.
 * Useful for reading rate limit thresholds inside the rotation service.
 */
export function getFreeModelMeta(
    provider: FreeProvider,
    modelId: string,
): FreeModelMeta | undefined {
    return (FREE_PROVIDER_MODELS[provider] as readonly FreeModelMeta[]).find(
        (m) => m.modelId === modelId,
    );
}

/**
 * Returns all free model IDs for a given provider as a flat string array.
 * Useful for Redis key generation and logging.
 */
export function getFreeModelIds(provider: FreeProvider): string[] {
    return FREE_PROVIDER_MODELS[provider].map((m) => m.modelId);
}
