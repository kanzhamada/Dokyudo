import { z } from "@hono/zod-openapi";

// ─────────────────────────────────────────────────────────────────────────────
// Register Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const RegisterBodySchema = z
    .object({
        email: z
            .string()
            .email()
            .min(1, "Email is required")
            .max(255, "Email is too long")
            .openapi({
                description: "User email address",
                example: "user@example.com",
            }),
        password: z
            .string()
            .min(8, "Password must be at least 8 characters")
            .max(72, "Password is too long")
            .regex(
                /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).+$/,
                "Must contain uppercase, lowercase, number, and symbol (e.g. Secure@123)",
            )
            .openapi({
                description: "User password (min 8 chars, strong)",
                example: "Secure@123",
            }),
        recaptchaToken: z
            .string()
            .min(1, "reCAPTCHA token is required")
            .openapi({
                description:
                    "Google reCAPTCHA v3 token from client-side execute()",
            }),
    })
    .openapi("RegisterBody");
export type RegisterBody = z.infer<typeof RegisterBodySchema>;

const RegisterParamsSchema = RegisterBodySchema.extend({
    clientIp: z.string(),
    userAgent: z.string(),
    requestId: z.string(),
    logContext: z.any().optional(),
});

export type RegisterParams = z.infer<typeof RegisterParamsSchema>;

export const RegisterResponseSchema = z
    .object({
        message: z.string().openapi({
            description: "Success message",
            example:
                "Registration successful. Please check your email for verification.",
        }),
    })
    .openapi("RegisterResponse");

// ─────────────────────────────────────────────────────────────────────────────
// Login Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const LoginBodySchema = z
    .object({
        email: z
            .string()
            .email()
            .min(1, "Email is required")
            .max(255, "Email is too long")
            .openapi({
                description: "User email address",
                example: "user@example.com",
            }),
        password: z
            .string()
            .min(1, "Password is required")
            .max(72, "Password is too long")
            .openapi({ description: "User password" }),
        recaptchaToken: z
            .string()
            .min(1, "reCAPTCHA token is required")
            .openapi({
                description:
                    "Google reCAPTCHA v3 token from client-side execute()",
            }),
    })
    .openapi("LoginBody");
export type LoginBody = z.infer<typeof LoginBodySchema>;

const LoginParamsSchema = LoginBodySchema.extend({
    clientIp: z.string(),
    userAgent: z.string(),
    requestId: z.string(),
    logContext: z.any().optional(),
});

export type LoginParams = z.infer<typeof LoginParamsSchema>;

export const LoginResponseSchema = z
    .object({
        accessToken: z
            .string()
            .openapi({ description: "Short-lived JWT access token" }),
        refreshToken: z.string().openapi({
            description: "Refresh token for obtaining new access tokens",
        }),
        user: z.object({
            id: z.string().uuid().openapi({ description: "User UUID" }),
            email: z.string().email().max(255, "Email is too long").openapi({
                description: "User email",
            }),
        }),
    })
    .openapi("LoginResponse");

export const LoginAttemptParamsSchema = z.object({
    email: z.string(),
    ipAddress: z.string(),
    userAgent: z.string(),
    isSuccess: z.boolean(),
    authProvider: z.string().optional(),
    logContext: z.any().optional(),
});

export type LoginAttemptParams = z.infer<typeof LoginAttemptParamsSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Logout Schemas
// ─────────────────────────────────────────────────────────────────────────────

const LogoutParamsSchema = z.object({
    accessToken: z.string(),
    logContext: z.any().optional(),
});

export type LogoutParams = z.infer<typeof LogoutParamsSchema>;

export const LogoutResponseSchema = z
    .object({
        message: z.string().openapi({
            description: "Success message",
            example: "Successfully logged out",
        }),
    })
    .openapi("LogoutResponse");

// ─────────────────────────────────────────────────────────────────────────────
// Password Recovery Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const ForgetPasswordBodySchema = z
    .object({
        email: z.string().email().max(255, "Email is too long").openapi({
            description: "User email address",
            example: "user@example.com",
        }),
        recaptchaToken: z
            .string()
            .min(1, "reCAPTCHA token is required")
            .openapi({
                description: "Google reCAPTCHA v3 token",
            }),
    })
    .openapi("ForgetPasswordBody");
export type ForgetPasswordBody = z.infer<typeof ForgetPasswordBodySchema>;

const ForgetPasswordParamsSchema = ForgetPasswordBodySchema.extend({
    clientIp: z.string(),
    userAgent: z.string(),
    requestId: z.string(),
    logContext: z.any().optional(),
});

export type ForgetPasswordParams = z.infer<typeof ForgetPasswordParamsSchema>;

export const ForgetPasswordResponseSchema = z
    .object({
        message: z.string().openapi({
            description: "Success message",
            example: "If an account exists, a recovery email has been sent.",
        }),
    })
    .openapi("ForgetPasswordResponse");

export const ResetPasswordBodySchema = z
    .object({
        email: z.string().email().max(255, "Email is too long").openapi({
            description: "User email address",
            example: "user@example.com",
        }),
        otp: z.string().length(8, "OTP must be exactly 8 characters").openapi({
            description: "8-digit OTP received via email",
            example: "12345678",
        }),
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
    .openapi("ResetPasswordBody");
export type ResetPasswordBody = z.infer<typeof ResetPasswordBodySchema>;

const ResetPasswordParamsSchema = ResetPasswordBodySchema.extend({
    clientIp: z.string(),
    userAgent: z.string(),
    requestId: z.string(),
    logContext: z.any().optional(),
});

export type ResetPasswordParams = z.infer<typeof ResetPasswordParamsSchema>;

export const ResetPasswordResponseSchema = z
    .object({
        message: z.string().openapi({
            description: "Success message",
            example: "Password has been successfully reset. Please log in.",
        }),
    })
    .openapi("ResetPasswordResponse");

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

const UpdatePasswordParamsSchema = UpdatePasswordBodySchema.extend({
    accessToken: z.string(),
    logContext: z.any().optional(),
});

export type UpdatePasswordParams = z.infer<typeof UpdatePasswordParamsSchema>;

export const UpdatePasswordResponseSchema = z
    .object({
        message: z.string().openapi({
            description: "Success message",
            example: "Password successfully updated. Please log in again.",
        }),
    })
    .openapi("UpdatePasswordResponse");

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
            uploadsCount: z.number(),
            searchesCount: z.number(),
            qaCount: z.number(),
            storageUsedBytes: z.number(),
        }),
    })
    .openapi("ProfileResponse");

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

const UpdateTenantNameParamsSchema = UpdateTenantNameBodySchema.extend({
    tenantId: z.string().uuid(),
    logContext: z.any().optional(),
});

export type UpdateTenantNameParams = z.infer<typeof UpdateTenantNameParamsSchema>;

export const UpdateTenantNameResponseSchema = z
    .object({
        tenant: z.object({
            id: z.string().uuid().openapi({ example: "9462a645-c164-4878-8171-8b35d26ace4f" }),
            name: z.string().openapi({ example: "Acme Corporation" }),
        }),
        message: z.string().openapi({ example: "Tenant name updated successfully." }),
    })
    .openapi("UpdateTenantNameResponse");
