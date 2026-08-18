import { createApp } from "../../config/hono.ts";
import { createRoute, z } from "@hono/zod-openapi";
import * as authController from "./auth.controller.ts";
import { ErrorResponseSchema } from "../../shared/schemas/shared.schema.ts";
import * as AuthSchema from "./auth.schema.ts";
import { oauthRoutes } from "./oauth/mod.ts";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.ts";

export const authRoutes = createApp();

// Mount OAuth sub-routes (GET /oauth/google, /oauth/google/callback, etc.)
authRoutes.route("/", oauthRoutes);

// Lightweight session check used by the SPA to hydrate its auth state.
// Returns 200 with { authenticated: false } instead of 401 so the client
// does not treat "not logged in" as an error.
authRoutes.get("/session", authController.handleSession as any);

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
            schema: AuthSchema.RegisterBodySchema,
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
            schema: AuthSchema.RegisterResponseSchema,
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
  }),
  authController.handleRegister as any,
);

authRoutes.openapi(
  createRoute({
    method: "post",
    path: "/verify-email",
    tags: ["Auth"],
    summary: "Verify email address using token hash",
    description:
      "Verifies a user's email address using the token_hash passed from the custom verification link sent to their inbox. " +
      "Returns a active JWT access token, refresh token, and user profile upon success.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: AuthSchema.VerifyEmailBodySchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Verification successful — session tokens returned",
        content: {
          "application/json": {
            schema: AuthSchema.VerifyEmailResponseSchema,
          },
        },
      },
      401: {
        description: "Invalid or expired token hash",
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
  authController.handleVerifyEmail as any,
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
            schema: AuthSchema.LoginBodySchema,
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
            schema: AuthSchema.LoginResponseSchema,
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
            schema: AuthSchema.LogoutResponseSchema,
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
            schema: AuthSchema.ForgetPasswordBodySchema,
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
            schema: AuthSchema.ForgetPasswordResponseSchema,
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
      "Verifies the 8-digit OTP from the recovery email and updates the password.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: AuthSchema.ResetPasswordBodySchema,
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
            schema: AuthSchema.ResetPasswordResponseSchema,
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
            schema: AuthSchema.UpdatePasswordBodySchema,
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
            schema: AuthSchema.UpdatePasswordResponseSchema,
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

authRoutes.openapi(
  createRoute({
    method: "patch",
    path: "/tenant/name",
    tags: ["Auth"],
    summary: "Update tenant workspace name",
    description:
      "Updates the display name of the authenticated user's tenant. " +
      "Requires a valid access token. Name must be between 2 and 255 characters.",
    middleware: [authMiddleware] as const,
    request: {
      body: {
        content: {
          "application/json": {
            schema: AuthSchema.UpdateTenantNameBodySchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        description: "Tenant name updated successfully",
        content: {
          "application/json": {
            schema: AuthSchema.UpdateTenantNameResponseSchema,
          },
        },
      },
      400: {
        description: "Validation error (name too short/long)",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
      401: {
        description: "Unauthorized",
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
  authController.handleUpdateTenantName as any,
);

authRoutes.openapi(
  createRoute({
    method: "delete",
    path: "/account",
    tags: ["Auth"],
    summary: "Permanently delete the authenticated account",
    description:
      "Schedules deletion of the authenticated account. Marks the user and tenant " +
      "as deletion_pending, revokes all sessions, and enqueues an asynchronous purge " +
      "job that deletes documents, chunks, vector embeddings, files, conversations, " +
      "shares, tenant keys, and Redis state — while retaining payment history and " +
      "audit logs. Re-registering with the same email afterwards creates a brand-new " +
      "clean account. Returns 202 (accepted).",
    middleware: [authMiddleware] as const,
    request: {
      // No body required — the authenticated session identifies the account.
    },
    responses: {
      202: {
        description: "Deletion scheduled",
        content: {
          "application/json": {
            schema: AuthSchema.DeleteAccountResponseSchema,
          },
        },
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: "Account not found or already deleted",
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
  authController.handleDeleteAccount as any,
);
