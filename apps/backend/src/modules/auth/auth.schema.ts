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

// ─────────────────────────────────────────────────────────────────────────────
// Logout Schemas
// ─────────────────────────────────────────────────────────────────────────────

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

export const UpdatePasswordResponseSchema = z
    .object({
        message: z.string().openapi({
            description: "Success message",
            example: "Password successfully updated. Please log in again.",
        }),
    })
    .openapi("UpdatePasswordResponse");
