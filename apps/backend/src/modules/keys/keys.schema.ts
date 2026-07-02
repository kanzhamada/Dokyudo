import { z } from "zod";

export const UpsertKeyBodySchema = z.object({
    provider: z.enum(["gemini", "mistral", "openrouter"]).default("gemini"),
    apiKey: z.string().min(1, "API Key is required"),
});

export const ProviderParamSchema = z.object({
    provider: z.enum(["gemini", "mistral", "openrouter"]),
});

export const KeyResponseSchema = z.object({
    provider: z.string(),
    maskedKey: z.string(),
    updatedAt: z.string(),
});
