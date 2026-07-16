/**
 * Canonical LLM model registry for Dokyudo's BYOK (Bring Your Own Key) feature.
 *
 * Design rationale:
 * - Using `const` objects with `as const` instead of `enum` because enum values
 *   compile to numeric indices or duplicate string assignments (const enum has
 *   isolation issues with Deno/bundlers). `as const` gives us literal type narrowing,
 *   autocompletion, and plain-string serialization — all at zero runtime cost.
 * - Flat arrays of valid model IDs per provider are used for validation in Zod schemas.
 * - `LlmModel` union type is derived at the type level, so no duplication.
 */

// ==============================================================================
// 1. MODEL REGISTRIES PER PROVIDER
// ==============================================================================

export const GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.1-pro-preview",
    "gemini-2.5-pro",
] as const;

export const MISTRAL_MODELS = [
    "codestral-latest",
    "devstral-medium-latest",
    "ministral-14b-latest",
    "ministral-3b-latest",
    "ministral-8b-latest",
    "mistral-large-latest",
    "mistral-medium-latest",
    "mistral-small-latest",
    "open-mistral-nemo",
] as const;

export const OPENROUTER_MODELS = [
    "openrouter/free",
] as const;

// ==============================================================================
// 2. INFERRED TYPES
// ==============================================================================

export type GeminiModel = typeof GEMINI_MODELS[number];
export type MistralModel = typeof MISTRAL_MODELS[number];
export type OpenRouterModel = typeof OPENROUTER_MODELS[number];

/** Union of all valid model IDs across all providers */
export type LlmModel = GeminiModel | MistralModel | OpenRouterModel;

/** Union of all valid provider names */
export type LlmProvider = "gemini" | "mistral" | "openrouter";

// ==============================================================================
// 3. PROVIDER → MODEL MAP (for validation & API documentation)
// ==============================================================================

export const PROVIDER_MODELS = {
    gemini: GEMINI_MODELS,
    mistral: MISTRAL_MODELS,
    openrouter: OPENROUTER_MODELS,
} as const satisfies Record<LlmProvider, readonly string[]>;

/**
 * Returns true if the given model string is a valid model for the given provider.
 * Use this as a guard clause in controllers/services before passing to the LLM SDK.
 */
export function isValidModelForProvider(provider: LlmProvider, model: string): boolean {
    return (PROVIDER_MODELS[provider] as readonly string[]).includes(model);
}
