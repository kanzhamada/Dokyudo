import { type Context } from "hono";
import { getEnv } from "../../config/env.ts";
import * as oauthService from "./oauth.service.ts";

export async function handleGoogleRedirect(c: Context) {
    const authUrl = await oauthService.initiateOAuth("google");

    if (c.get("logContext")) {
        c.get("logContext").authEvent = "oauth_google_redirect";
    }

    return c.redirect(authUrl);
}

export async function handleGitHubRedirect(c: Context) {
    const authUrl = await oauthService.initiateOAuth("github");

    if (c.get("logContext")) {
        c.get("logContext").authEvent = "oauth_github_redirect";
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
async function processOAuthCallback(c: Context, provider: string) {
    const code = c.req.query("code");
    const errorParam = c.req.query("error");
    const errorDescription = c.req.query("error_description");

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
        const result = await oauthService.handleOAuthCallback(code);

        if (c.get("logContext")) {
            const logContext = c.get("logContext");
            logContext.authEvent = `oauth_${provider}_success`;
            logContext.authEmail = result.user.email;
            logContext.userId = result.user.id;
        }

        // Redirect to frontend with tokens
        const frontendUrl = getEnv("FRONTEND_URL");
        const params = new URLSearchParams({
            access_token: result.accessToken,
            refresh_token: result.refreshToken,
        });

        return c.redirect(`${frontendUrl}/oauth-callback?${params.toString()}`);
    } catch (error: any) {
        if (c.get("logContext")) {
            const logContext = c.get("logContext");
            logContext.authEvent = `oauth_${provider}_failed`;
            logContext.authError = error.message;
        }

        // Redirect to frontend with error instead of returning JSON
        // (since the user is in a browser redirect flow, not an API call)
        const frontendUrl = getEnv("FRONTEND_URL");
        const errorMsg = encodeURIComponent(error.message || "OAuth authentication failed");
        return c.redirect(`${frontendUrl}/oauth-callback?error=${errorMsg}`);
    }
}
