import { z } from "@hono/zod-openapi";

// ─────────────────────────────────────────────────────────────────────────────
// Profile Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const ProfileResponseSchema = z
    .object({
        user: z.object({
            id: z.string().uuid(),
            email: z.string().email(),
            profilePictureUrl: z.string().nullable().optional(),
        }),
        tenant: z.object({
            id: z.string().uuid(),
            name: z.string(),
        }),
        subscription: z.object({
            tier: z.enum(["FREE", "SIMULATE", "OIL_INVESTOR", "PRO"]),
            expiresAt: z.string().nullable().optional(),
        }),
    })
    .openapi("ProfileResponse");

export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Usage Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const UsageResponseSchema = z
    .object({
        tier: z.enum(["FREE", "SIMULATE", "OIL_INVESTOR", "PRO"]),
        uploadsCount: z.number().openapi({
            description: "Number of documents uploaded by tenant",
            example: 3,
        }),
        searchesCount: z.number().openapi({
            description: "Number of semantic searches executed",
            example: 12,
        }),
        qaCount: z.number().openapi({
            description: "Number of Q&A chat messages processed",
            example: 45,
        }),
        storageUsedBytes: z.number().openapi({
            description: "Total storage used by tenant documents in bytes",
            example: 70680962,
        }),
    })
    .openapi("UsageResponse");

export type UsageResponse = z.infer<typeof UsageResponseSchema>;
