import { z } from "@hono/zod-openapi";

// ─────────────────────────────────────────────────────────────────────────────
// Register Schemas
// ─────────────────────────────────────────────────────────────────────────────

export const RegisterBodySchema = z
    .object({
        email: z
            .string()
            .email()
            .openapi({ description: "User email address", example: "user@example.com" }),
        password: z
            .string()
            .min(8, "Password must be at least 8 characters")
            .openapi({ description: "User password (min 8 chars)", example: "SecurePassword123!" }),
        recaptchaToken: z
            .string()
            .min(1, "reCAPTCHA token is required")
            .openapi({ description: "Google reCAPTCHA v3 token from client-side execute()" }),
    })
    .openapi("RegisterBody");

export const RegisterResponseSchema = z
    .object({
        message: z
            .string()
            .openapi({
                description: "Success message",
                example: "Registration successful. Please check your email for verification.",
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
            .openapi({ description: "User email address", example: "user@example.com" }),
        password: z
            .string()
            .min(1, "Password is required")
            .openapi({ description: "User password" }),
        recaptchaToken: z
            .string()
            .min(1, "reCAPTCHA token is required")
            .openapi({ description: "Google reCAPTCHA v3 token from client-side execute()" }),
    })
    .openapi("LoginBody");

export const LoginResponseSchema = z
    .object({
        accessToken: z
            .string()
            .openapi({ description: "Short-lived JWT access token" }),
        refreshToken: z
            .string()
            .openapi({ description: "Refresh token for obtaining new access tokens" }),
        user: z.object({
            id: z.string().uuid().openapi({ description: "User UUID" }),
            email: z.string().email().openapi({ description: "User email" }),
        }),
    })
    .openapi("LoginResponse");
