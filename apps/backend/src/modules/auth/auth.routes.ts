import { createApp } from "../../config/hono.ts";
import { createRoute, z } from "@hono/zod-openapi";
import * as authController from "./auth.controller.ts";
import { ErrorResponseSchema } from "../../shared/schemas/shared.schema.ts";
import {
    LoginBodySchema,
    LoginResponseSchema,
    RegisterBodySchema,
    RegisterResponseSchema,
    LogoutResponseSchema,
    ForgetPasswordBodySchema,
    ForgetPasswordResponseSchema,
    ResetPasswordBodySchema,
    ResetPasswordResponseSchema,
    UpdatePasswordBodySchema,
    UpdatePasswordResponseSchema,
} from "./auth.schema.ts";
import { oauthRoutes } from "./oauth.routes.ts";

export const authRoutes = createApp();

// Mount OAuth sub-routes (GET /oauth/google, /oauth/google/callback, etc.)
authRoutes.route("/", oauthRoutes);

authRoutes.openapi(
    createRoute({
        method: "post",
        path: "/register",
        tags: ["Auth"],
        summary: "Register a new user",
        description:
            "Creates a new user account via Supabase Auth. Validates reCAPTCHA v3 token first. " +
            "User must verify their email before they can log in. " +
            "A database trigger automatically creates the tenant and public.users record upon email verification.",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: RegisterBodySchema,
                    },
                },
                required: true,
            },
        },
        responses: {
            201: {
                description:
                    "Registration successful — check email for verification",
                content: {
                    "application/json": {
                        schema: RegisterResponseSchema,
                    },
                },
            },
            400: {
                description:
                    "Validation error (invalid input or reCAPTCHA failure)",
                content: {
                    "application/json": {
                        schema: ErrorResponseSchema,
                    },
                },
            },
            500: {
                description: "Internal server error",
                content: {
                    "application/json": {
                        schema: ErrorResponseSchema,
                    },
                },
            },
        },
    }),
    authController.handleRegister as any,
);

authRoutes.openapi(
    createRoute({
        method: "post",
        path: "/login",
        tags: ["Auth"],
        summary: "Login with email and password",
        description:
            "Authenticates a user via Supabase Auth after passing reCAPTCHA v3, lockout, and rate-limit checks. " +
            "Failed attempts are logged to public.login_attempts. " +
            "After 5 failed attempts (same email + IP) in 15 minutes, the account is locked for 15 minutes.",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: LoginBodySchema,
                    },
                },
                required: true,
            },
        },
        responses: {
            200: {
                description:
                    "Login successful — returns JWT tokens and user info",
                content: {
                    "application/json": {
                        schema: LoginResponseSchema,
                    },
                },
            },
            400: {
                description:
                    "Validation error (invalid input or reCAPTCHA failure)",
                content: {
                    "application/json": {
                        schema: ErrorResponseSchema,
                    },
                },
            },
            401: {
                description: "Invalid email or password",
                content: {
                    "application/json": {
                        schema: ErrorResponseSchema,
                    },
                },
            },
            403: {
                description:
                    "Account is currently locked due to too many failed attempts",
                content: {
                    "application/json": {
                        schema: ErrorResponseSchema,
                    },
                },
            },
            429: {
                description:
                    "Too many failed login attempts — account locked for 15 minutes",
                content: {
                    "application/json": {
                        schema: ErrorResponseSchema,
                    },
                },
            },
            500: {
                description: "Internal server error",
                content: {
                    "application/json": {
                        schema: ErrorResponseSchema,
                    },
                },
            },
        },
    }),
    authController.handleLogin as any,
);

authRoutes.openapi(
    createRoute({
        method: "post",
        path: "/logout",
        tags: ["Auth"],
        summary: "Logout the current user",
        description:
            "Invalidates the user's session globally using the Supabase Admin API. Expects a Bearer token in the Authorization header.",
        request: {
            headers: z.object({
                authorization: z.string().optional().openapi({
                    description: "Bearer <token>",
                    example: "Bearer eyJhb...",
                }),
            }),
        },
        responses: {
            200: {
                description: "Logout successful",
                content: {
                    "application/json": {
                        schema: LogoutResponseSchema,
                    },
                },
            },
            401: {
                description: "Missing or invalid authorization token",
                content: {
                    "application/json": {
                        schema: ErrorResponseSchema,
                    },
                },
            },
            500: {
                description: "Internal server error",
                content: {
                    "application/json": {
                        schema: ErrorResponseSchema,
                    },
                },
            },
        },
    }),
    authController.handleLogout as any,
);

authRoutes.openapi(
    createRoute({
        method: "post",
        path: "/forget-password",
        tags: ["Auth"],
        summary: "Request a password reset link/OTP",
        description:
            "Generates a recovery OTP and magic link via Supabase and sends it to the user's email via Resend.",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: ForgetPasswordBodySchema,
                    },
                },
                required: true,
            },
        },
        responses: {
            200: {
                description: "Recovery email sent",
                content: {
                    "application/json": {
                        schema: ForgetPasswordResponseSchema,
                    },
                },
            },
            400: {
                description: "Validation error",
                content: {
                    "application/json": {
                        schema: ErrorResponseSchema,
                    },
                },
            },
            429: {
                description: "Rate limit exceeded",
                content: {
                    "application/json": {
                        schema: ErrorResponseSchema,
                    },
                },
            },
            500: {
                description: "Internal server error",
                content: {
                    "application/json": {
                        schema: ErrorResponseSchema,
                    },
                },
            },
        },
    }),
    authController.handleForgetPassword as any,
);

authRoutes.openapi(
    createRoute({
        method: "post",
        path: "/reset-password",
        tags: ["Auth"],
        summary: "Reset password using OTP",
        description:
            "Verifies the 6-digit OTP from the recovery email and updates the password.",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: ResetPasswordBodySchema,
                    },
                },
                required: true,
            },
        },
        responses: {
            200: {
                description: "Password reset successful",
                content: {
                    "application/json": {
                        schema: ResetPasswordResponseSchema,
                    },
                },
            },
            400: {
                description: "Validation error",
                content: {
                    "application/json": {
                        schema: ErrorResponseSchema,
                    },
                },
            },
            401: {
                description: "Invalid or expired OTP",
                content: {
                    "application/json": {
                        schema: ErrorResponseSchema,
                    },
                },
            },
            500: {
                description: "Internal server error",
                content: {
                    "application/json": {
                        schema: ErrorResponseSchema,
                    },
                },
            },
        },
    }),
    authController.handleResetPassword as any,
);

authRoutes.openapi(
    createRoute({
        method: "put",
        path: "/update-password",
        tags: ["Auth"],
        summary: "Update password for authenticated user",
        description:
            "Updates the password for a logged-in user using their Bearer token, then invalidates all sessions to force re-login.",
        request: {
            headers: z.object({
                authorization: z.string().optional().openapi({
                    description: "Bearer <token>",
                    example: "Bearer eyJhb...",
                }),
            }),
            body: {
                content: {
                    "application/json": {
                        schema: UpdatePasswordBodySchema,
                    },
                },
                required: true,
            },
        },
        responses: {
            200: {
                description: "Password updated successfully",
                content: {
                    "application/json": {
                        schema: UpdatePasswordResponseSchema,
                    },
                },
            },
            400: {
                description: "Validation error",
                content: {
                    "application/json": {
                        schema: ErrorResponseSchema,
                    },
                },
            },
            401: {
                description: "Invalid or expired session",
                content: {
                    "application/json": {
                        schema: ErrorResponseSchema,
                    },
                },
            },
            500: {
                description: "Internal server error",
                content: {
                    "application/json": {
                        schema: ErrorResponseSchema,
                    },
                },
            },
        },
    }),
    authController.handleUpdatePassword as any,
);
