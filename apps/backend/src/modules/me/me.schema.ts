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
    expiresAt: z.string().nullable().optional(),
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

// ─────────────────────────────────────────────────────────────────────────────
// Account Deletion Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const DeleteAccountResponseSchema = z
  .object({
    message: z.string().openapi({
      description: "Deletion scheduled message",
      example: "Account deletion scheduled. Your data will be purged shortly.",
    }),
    scheduled: z.boolean().openapi({ example: true }),
    jobId: z.string().uuid().openapi({
      description: "Identifier of the async deletion job",
    }),
  })
  .openapi("DeleteAccountResponse");

export type DeleteAccountResponse = z.infer<typeof DeleteAccountResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Update Password Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const UpdatePasswordBodySchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password is too long")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).+$/,
        "Must contain uppercase, lowercase, number, and symbol (e.g. Secure@123)",
      )
      .openapi({
        description: "New user password",
        example: "Secure@123",
      }),
  })
  .openapi("UpdatePasswordBody");

export type UpdatePasswordBody = z.infer<typeof UpdatePasswordBodySchema>;

export interface UpdatePasswordParams {
  accessToken: string;
  newPassword: string;
  logContext?: Record<string, any>;
}

export const UpdatePasswordResponseSchema = z
  .object({
    message: z.string().openapi({
      description: "Success message",
      example: "Password successfully updated. Please log in again.",
    }),
  })
  .openapi("UpdatePasswordResponse");

export type UpdatePasswordResponse = z.infer<typeof UpdatePasswordResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Update Tenant Name Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const UpdateTenantNameBodySchema = z
  .object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(255, "Name is too long")
      .trim()
      .openapi({
        description: "New display name for the tenant workspace",
        example: "Acme Corporation",
      }),
  })
  .openapi("UpdateTenantNameBody");

export type UpdateTenantNameBody = z.infer<typeof UpdateTenantNameBodySchema>;

export interface UpdateTenantNameParams {
  tenantId: string;
  userId: string;
  name: string;
  clientIp?: string;
  userAgent?: string;
  logContext?: Record<string, any>;
}

export const UpdateTenantNameResponseSchema = z
  .object({
    tenant: z.object({
      id: z.string().uuid().openapi({
        example: "9462a645-c164-4878-8171-8b35d26ace4f",
      }),
      name: z.string().openapi({ example: "Acme Corporation" }),
    }),
    message: z.string().openapi({
      example: "Tenant name updated successfully.",
    }),
  })
  .openapi("UpdateTenantNameResponse");

export type UpdateTenantNameResponse = z.infer<
  typeof UpdateTenantNameResponseSchema
>;
