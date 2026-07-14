import { getSupabaseAnon } from "../../../config/supabase.ts";
import { getEnv } from "../../../config/env.ts";
import { redis } from "../../../config/redis.ts";
import { AppError } from "../../../shared/utils/errors.util.ts";
import * as OAuthSchema from "./oauth.schema.ts";
import { getSupabaseAdmin } from "../../../config/supabase.ts";
import { db } from "../../../config/drizzle.ts";
import { loginAttempts } from "../../../shared/models/db.model.ts";

export interface OAuthCallbackResult {
    accessToken: string;
    refreshToken: string;
    user: {
        id: string;
        email: string;
    };
}

export class OAuthService {
    /**
     * Initiates the OAuth flow by generating the Supabase authorization URL.
     * Uses Supabase's built-in PKCE flow — no client_secret needed in our backend.
     */
    static async initiateOAuth(
        params: OAuthSchema.InitiateOAuthParams,
    ): Promise<string> {
        const supabase = getSupabaseAnon();

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: params.provider,
            options: {
                redirectTo: `${getEnv("FRONTEND_URL")}/oauth-callback`,
                skipBrowserRedirect: true,
            },
        });

        if (error || !data.url) {
            throw new AppError({
                code: "INTERNAL_ERROR",
                message: `Failed to initiate ${params.provider} OAuth flow`,
                status: 500,
            });
        }

        return data.url;
    }

    /**
     * Handles the OAuth callback by exchanging the authorization code for a session.
     * Enforces the email verification gate.
     */
    static async handleOAuthCallback(
        params: OAuthSchema.OAuthCallbackParams,
    ): Promise<OAuthCallbackResult> {
        if (!params.code) {
            throw new AppError({
                code: "VALIDATION_ERROR",
                message: "Missing authorization code from OAuth provider",
                status: 400,
            });
        }

        const supabase = getSupabaseAnon();

        // Exchange the PKCE code for a Supabase session
        const { data, error } = await supabase.auth.exchangeCodeForSession(
            params.code,
        );

        if (error || !data.session) {
            throw new AppError({
                code: "UNAUTHORIZED",
                message: "OAuth code exchange failed. Please try again.",
                status: 401,
            });
        }

        const { session, user } = data;

        // The backend MUST only proceed if email is verified.
        // Unverified emails trigger immediate session deletion + 401.
        const isEmailVerified =
            user.email_confirmed_at != null ||
            user.identities?.[0]?.identity_data?.email_verified === true;

        if (!isEmailVerified) {
            // Kill the session immediately — do not let unverified users through
            try {
                await getSupabaseAdmin().auth.admin.signOut(
                    session.access_token,
                    "global",
                );
            } catch (err: any) {
                if (params.logContext) {
                    params.logContext.authWarning =
                        "Failed to revoke unverified OAuth session: " +
                        err.message;
                }
            }

            // Audit log: record the failed attempt for security visibility
            try {
                await db.insert(loginAttempts).values({
                    emailAttempted: user.email ?? "unknown",
                    ipAddress: params.clientIp,
                    userAgent: params.userAgent,
                    isSuccess: false,
                    authProvider: `oauth_${params.provider}`,
                });
            } catch (logErr: any) {
                if (params.logContext) {
                    params.logContext.dbError_logLoginAttempt = logErr.message;
                }
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
            } catch (err: any) {
                if (params.logContext) {
                    params.logContext.redisError =
                        "Failed to clean up unverified email cache: " +
                        err.message;
                }
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
}
