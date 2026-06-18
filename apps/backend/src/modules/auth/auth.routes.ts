import { createApp } from "../../config/hono.ts";
import { createRoute } from "@hono/zod-openapi";
import * as authController from "./auth.controller.ts";
import { ErrorResponseSchema } from "../../shared/schemas/shared.schema.ts";
import { LoginBodySchema, LoginResponseSchema, RegisterBodySchema, RegisterResponseSchema } from "./auth.schema.ts";

export const authRoutes = createApp();

authRoutes.openapi(createRoute({
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
            description: "Registration successful — check email for verification",
            content: {
                "application/json": {
                    schema: RegisterResponseSchema,
                },
            },
        },
        400: {
            description: "Validation error (invalid input or reCAPTCHA failure)",
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
}), authController.handleRegister as any);

authRoutes.openapi(createRoute({
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
            description: "Login successful — returns JWT tokens and user info",
            content: {
                "application/json": {
                    schema: LoginResponseSchema,
                },
            },
        },
        400: {
            description: "Validation error (invalid input or reCAPTCHA failure)",
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
            description: "Account is currently locked due to too many failed attempts",
            content: {
                "application/json": {
                    schema: ErrorResponseSchema,
                },
            },
        },
        429: {
            description: "Too many failed login attempts — account locked for 15 minutes",
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
}), authController.handleLogin as any);
