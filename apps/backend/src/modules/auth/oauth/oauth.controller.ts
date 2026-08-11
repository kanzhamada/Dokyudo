import { type Context } from "hono";
import { getEnv } from "../../../config/env.ts";
import { OAuthService } from "./oauth.service.ts";
import { ContextExtractor } from "../../../shared/utils/context.util.ts";
import * as OAuthSchema from "./oauth.schema.ts";

export async function handleGoogleRedirect(c: Context) {
    const extractor = new ContextExtractor(c);
    const { logContext } = extractor.extractBaseContext();

    const params: OAuthSchema.InitiateOAuthParams = {
        provider: "google",
        logContext,
    };

    const authUrl = await OAuthService.initiateOAuth(params);

    if (logContext) {
        logContext.authEvent = "oauth_google_redirect";
    }

    return c.redirect(authUrl);
}

export async function handleGitHubRedirect(c: Context) {
    const extractor = new ContextExtractor(c);
    const { logContext } = extractor.extractBaseContext();

    const params: OAuthSchema.InitiateOAuthParams = {
        provider: "github",
        logContext,
    };

    const authUrl = await OAuthService.initiateOAuth(params);

    if (logContext) {
        logContext.authEvent = "oauth_github_redirect";
    }

    return c.redirect(authUrl);
}

export async function handleGoogleCallback(c: Context) {
    return await processOAuthCallback(c, "google");
}

export async function handleGitHubCallback(c: Context) {
    return await processOAuthCallback(c, "github");
}

/**
 * Shared callback handler for both Google and GitHub OAuth flows.
 * Exchanges the authorization code for a session and redirects to the frontend.
 */
async function processOAuthCallback(c: Context, provider: "google" | "github") {
    const extractor = new ContextExtractor(c);
    const { logContext } = extractor.extractBaseContext();
    const query = extractor.extractValidQuery<OAuthSchema.OAuthCallbackQuery>();

    const code = query.code;
    const errorParam = query.error;
    const errorDescription = query.error_description;

    // Handle provider-side errors (e.g., user denied consent)
    if (errorParam) {
        const frontendUrl = getEnv("FRONTEND_URL");
        const errorMsg = encodeURIComponent(errorDescription || errorParam);
        return c.redirect(`${frontendUrl}/oauth-callback?error=${errorMsg}`);
    }

    if (!code) {
        const frontendUrl = getEnv("FRONTEND_URL");
        return c.redirect(
            `${frontendUrl}/oauth-callback?error=${encodeURIComponent("Missing authorization code")}`,
        );
    }

    try {
        const { clientIp, userAgent, requestId } = extractor.extractAuditContext();
        const params: OAuthSchema.OAuthCallbackParams = {
            code,
            provider,
            error: errorParam,
            error_description: errorDescription,
            clientIp,
            userAgent,
            requestId,
            logContext,
        };

        const result = await OAuthService.handleOAuthCallback(params);

        if (logContext) {
            logContext.authEvent = `oauth_${provider}_success`;
            logContext.authEmail = result.user.email;
            logContext.userId = result.user.id;
        }

        // Redirect to frontend with tokens
        const frontendUrl = getEnv("FRONTEND_URL");
        const paramsObj = new URLSearchParams({
            access_token: result.accessToken,
            refresh_token: result.refreshToken,
        });

        return c.redirect(
            `${frontendUrl}/oauth-callback?${paramsObj.toString()}`,
        );
    } catch (error: any) {
        if (logContext) {
            logContext.authEvent = `oauth_${provider}_failed`;
            logContext.authError = error.message;
        }

        // Redirect to frontend with error instead of returning JSON
        // (since the user is in a browser redirect flow, not an API call)
        const frontendUrl = getEnv("FRONTEND_URL");
        const errorMsg = encodeURIComponent(
            error.message || "OAuth authentication failed",
        );
        return c.redirect(`${frontendUrl}/oauth-callback?error=${errorMsg}`);
    }
}
