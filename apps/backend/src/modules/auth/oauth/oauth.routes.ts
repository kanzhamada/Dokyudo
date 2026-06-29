import { createApp } from "../../../config/hono.ts";
import { createRoute, z } from "@hono/zod-openapi";
import * as oauthController from "./oauth.controller.ts";
import { ErrorResponseSchema } from "../../../shared/schemas/shared.schema.ts";
import { OAuthCallbackQuerySchema } from "./oauth.schema.ts";

export const oauthRoutes = createApp();

// ─────────────────────────────────────────────────────────────────────────────
// Google OAuth
// ─────────────────────────────────────────────────────────────────────────────

oauthRoutes.openapi(
    createRoute({
        method: "get",
        path: "/oauth/google",
        tags: ["Auth - OAuth"],
        summary: "Initiate Google OAuth login",
        description:
            "Redirects the user to Google's consent screen via Supabase's Server-Side PKCE flow. " +
            "After the user grants consent, Google redirects back to the callback endpoint.",
        responses: {
            302: {
                description: "Redirect to Google OAuth consent screen",
            },
            500: {
                description: "Failed to initiate OAuth flow",
                content: {
                    "application/json": {
                        schema: ErrorResponseSchema,
                    },
                },
            },
        },
    }),
    oauthController.handleGoogleRedirect as any,
);

oauthRoutes.openapi(
    createRoute({
        method: "get",
        path: "/oauth/google/callback",
        tags: ["Auth - OAuth"],
        summary: "Handle Google OAuth callback",
        description:
            "Receives the authorization code from Google, exchanges it for a Supabase session, " +
            "enforces the email verification gate (PRD §5.1), and redirects to the frontend with tokens. " +
            "New users get a tenant automatically provisioned via the database trigger.",
        request: {
            query: OAuthCallbackQuerySchema,
        },
        responses: {
            302: {
                description:
                    "Redirect to frontend with access_token and refresh_token (or error)",
            },
        },
    }),
    oauthController.handleGoogleCallback as any,
);

// ─────────────────────────────────────────────────────────────────────────────
// GitHub OAuth
// ─────────────────────────────────────────────────────────────────────────────

oauthRoutes.openapi(
    createRoute({
        method: "get",
        path: "/oauth/github",
        tags: ["Auth - OAuth"],
        summary: "Initiate GitHub OAuth login",
        description:
            "Redirects the user to GitHub's authorization page via Supabase's Server-Side PKCE flow. " +
            "After the user grants consent, GitHub redirects back to the callback endpoint.",
        responses: {
            302: {
                description: "Redirect to GitHub OAuth authorization page",
            },
            500: {
                description: "Failed to initiate OAuth flow",
                content: {
                    "application/json": {
                        schema: ErrorResponseSchema,
                    },
                },
            },
        },
    }),
    oauthController.handleGitHubRedirect as any,
);

oauthRoutes.openapi(
    createRoute({
        method: "get",
        path: "/oauth/github/callback",
        tags: ["Auth - OAuth"],
        summary: "Handle GitHub OAuth callback",
        description:
            "Receives the authorization code from GitHub, exchanges it for a Supabase session, " +
            "enforces the email verification gate (PRD §5.1), and redirects to the frontend with tokens. " +
            "New users get a tenant automatically provisioned via the database trigger.",
        request: {
            query: OAuthCallbackQuerySchema,
        },
        responses: {
            302: {
                description:
                    "Redirect to frontend with access_token and refresh_token (or error)",
            },
        },
    }),
    oauthController.handleGitHubCallback as any,
);
