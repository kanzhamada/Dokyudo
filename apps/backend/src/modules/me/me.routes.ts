import { createApp } from "../../config/hono.ts";
import { createRoute, z } from "@hono/zod-openapi";
import * as meController from "./me.controller.ts";
import * as MeSchema from "./me.schema.ts";
import { ErrorResponseSchema } from "../../shared/schemas/shared.schema.ts";

export const meRoutes = createApp();

meRoutes.openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: ["Me"],
    summary: "Get current user profile and subscription tier",
    description:
      "Returns user details, tenant info, and current subscription status. Automatically handles lazy-downgrade if subscription is expired.",
    responses: {
      200: {
        description: "Profile returned successfully",
        content: {
          "application/json": {
            schema: MeSchema.ProfileResponseSchema,
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
  meController.handleGetProfile as any,
);

meRoutes.openapi(
  createRoute({
    method: "get",
    path: "/usage",
    tags: ["Me"],
    summary: "Get realtime tenant usage statistics",
    description:
      "Returns uploads count, searches count, QA count, and storage used bytes for the authenticated tenant.",
    responses: {
      200: {
        description: "Usage statistics returned successfully",
        content: {
          "application/json": {
            schema: MeSchema.UsageResponseSchema,
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
        description: "Subscription not found",
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
  meController.handleGetUsage as any,
);

meRoutes.openapi(
  createRoute({
    method: "delete",
    path: "/account",
    tags: ["Me"],
    summary: "Permanently delete the authenticated account",
    description:
      "Schedules deletion of the authenticated account. Marks the user and tenant " +
      "as deletion_pending, revokes all sessions, and enqueues an asynchronous purge " +
      "job that deletes documents, chunks, vector embeddings, files, conversations, " +
      "shares, tenant keys, and Redis state — while retaining payment history and " +
      "audit logs. Re-registering with the same email afterwards creates a brand-new " +
      "clean account. Returns 202 (accepted).",
    responses: {
      202: {
        description: "Deletion scheduled",
        content: {
          "application/json": {
            schema: MeSchema.DeleteAccountResponseSchema,
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
  meController.handleDeleteAccount as any,
);

meRoutes.openapi(
  createRoute({
    method: "put",
    path: "/update-password",
    tags: ["Me"],
    summary: "Update password for authenticated user",
    description:
      "Updates the password for a logged-in user using their session or Bearer token, then invalidates all sessions to force re-login.",
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
            schema: MeSchema.UpdatePasswordBodySchema,
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
            schema: MeSchema.UpdatePasswordResponseSchema,
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
  meController.handleUpdatePassword as any,
);

meRoutes.openapi(
  createRoute({
    method: "patch",
    path: "/tenant/name",
    tags: ["Me"],
    summary: "Update tenant workspace name",
    description:
      "Updates the display name of the authenticated user's tenant. " +
      "Requires a valid access token. Name must be between 2 and 255 characters.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: MeSchema.UpdateTenantNameBodySchema,
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
            schema: MeSchema.UpdateTenantNameResponseSchema,
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
  meController.handleUpdateTenantName as any,
);
