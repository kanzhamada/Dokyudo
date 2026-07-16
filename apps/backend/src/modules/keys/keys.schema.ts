import { z } from "zod";
import { GEMINI_MODELS, MISTRAL_MODELS, OPENROUTER_MODELS } from "../../shared/constants/llm_providers.constant.ts";

// Derive provider enum directly from the canonical constant so it stays in sync
const PROVIDERS = ["gemini", "mistral", "openrouter"] as const;

export const UpsertKeyBodySchema = z.object({
    provider: z.enum(PROVIDERS).default("gemini").openapi({
        description: "LLM provider to store the API key for",
        example: "gemini",
    }),
    apiKey: z.string().min(1, "API Key is required").openapi({
        description: "BYOK API key for the selected provider",
        example: "sk-or-v1-...",
    }),
});

export const ProviderParamSchema = z.object({
    provider: z.enum(PROVIDERS),
});

export const KeyResponseSchema = z.object({
    provider: z.string().openapi({ example: "gemini" }),
    maskedKey: z.string().openapi({ example: "AIza...1234" }),
    models: z.array(z.string()).openapi({
        description: "Available models for this provider",
        example: ["gemini-2.5-flash", "gemini-2.5-pro"],
    }),
    updatedAt: z.string().openapi({ example: "2024-01-01T00:00:00.000Z" }),
});

/**
 * Schema used by the frontend/docs to list available models per provider.
 * Derived from the canonical constant — no duplication.
 */
export const AvailableModelsResponseSchema = z.object({
    gemini: z.array(z.enum(GEMINI_MODELS)),
    mistral: z.array(z.enum(MISTRAL_MODELS)),
    openrouter: z.array(z.enum(OPENROUTER_MODELS)),
});
