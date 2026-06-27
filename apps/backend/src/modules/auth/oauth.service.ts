import { getSupabaseAnon } from "../../config/supabase.ts";
import { getEnv } from "../../config/env.ts";
import { redis } from "../../config/redis.ts";
import { AppError } from "../../shared/utils/errors.util.ts";

type OAuthProvider = "google" | "github";

/**
 * Initiates the OAuth flow by generating the Supabase authorization URL.
 * Uses Supabase's built-in PKCE flow — no client_secret needed in our backend.
 */
export async function initiateOAuth(provider: OAuthProvider): Promise<string> {
    const supabase = getSupabaseAnon();

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: `${getEnv("FRONTEND_URL")}/oauth-callback`,
            skipBrowserRedirect: true,
        },
    });

    if (error || !data.url) {
        throw new AppError({
            code: "INTERNAL_ERROR",
            message: `Failed to initiate ${provider} OAuth flow`,
            status: 500,
        });
    }

    return data.url;
}

interface OAuthCallbackResult {
    accessToken: string;
    refreshToken: string;
    user: {
        id: string;
        email: string;
    };
}

/**
 * Handles the OAuth callback by exchanging the authorization code for a session.
 * Enforces the PRD email verification gate (§5.1).
 */
export async function handleOAuthCallback(
    code: string,
): Promise<OAuthCallbackResult> {
    if (!code) {
        throw new AppError({
            code: "VALIDATION_ERROR",
            message: "Missing authorization code from OAuth provider",
            status: 400,
        });
    }

    const supabase = getSupabaseAnon();

    // Exchange the PKCE code for a Supabase session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session) {
        throw new AppError({
            code: "UNAUTHORIZED",
            message: "OAuth code exchange failed. Please try again.",
            status: 401,
        });
    }

    const { session, user } = data;

    // PRD §5.1: Email Verification Gate
    // The backend MUST only proceed if email is verified.
    // Unverified emails trigger immediate session deletion + 401.
    const isEmailVerified =
        user.email_confirmed_at != null ||
        user.identities?.[0]?.identity_data?.email_verified === true;

    if (!isEmailVerified) {
        // Kill the session immediately — do not let unverified users through
        try {
            const { getSupabaseAdmin } =
                await import("../../config/supabase.ts");
            await getSupabaseAdmin().auth.admin.signOut(
                session.access_token,
                "global",
            );
        } catch (err) {
            console.error("Failed to revoke unverified OAuth session:", err);
        }

        throw new AppError({
            code: "UNAUTHORIZED",
            message:
                "Email address is not verified. Please verify your email before logging in.",
            status: 401,
        });
    }

    // Cleanup: Remove the unverified email cooldown cache if present
    if (user.email) {
        try {
            await redis.del(`unverified_email:${user.email}`);
        } catch (err) {
            console.error(
                "Failed to clean up unverified email cache from Redis",
                err,
            );
        }
    }

    return {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        user: {
            id: user.id,
            email: user.email!,
        },
    };
}
