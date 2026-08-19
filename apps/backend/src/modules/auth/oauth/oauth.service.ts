import { getSupabaseAnon, getSupabaseAdmin } from "../../../config/supabase.ts";
import { getEnv } from "../../../config/env.ts";
import { redis } from "../../../config/redis.ts";
import { AppError } from "../../../shared/utils/errors.util.ts";
import { sendWelcomeEmailOnce } from "../../../shared/utils/email.util.ts";
import * as OAuthSchema from "./oauth.schema.ts";
import { db } from "../../../config/drizzle.ts";
import {
    activityLogs,
    loginAttempts,
    users,
} from "../../../shared/models/db.model.ts";
import { and, count, eq } from "drizzle-orm";
import { logActivity } from "../../../shared/utils/activity.util.ts";
import { AccountDeletionService } from "../../account_deletion/account_deletion.service.ts";
import { provisionTenantForUser } from "../user_provision.util.ts";

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
                // The anon client is created with flowType "pkce" (see
                // config/supabase.ts), so the auth code comes back to OUR
                // backend callback — not the frontend — and
                // handleOAuthCallback can provision the tenant and record
                // auth.login in activity_logs.
                redirectTo: `${getEnv("API_URL")}/api/auth/oauth/${params.provider}/callback`,
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
        let exchangeResult;
        try {
            exchangeResult = await supabase.auth.exchangeCodeForSession(
                params.code,
            );
        } catch (exchangeErr: any) {
            // Thrown (not returned as {error}) e.g. when the PKCE verifier is
            // gone from memory — a server restart between initiate and
            // callback. Report it as a clean auth failure, not a 500.
            if (params.logContext) {
                params.logContext.oauthExchangeError = exchangeErr.message;
            }
            throw new AppError({
                code: "UNAUTHORIZED",
                message: "OAuth code exchange failed. Please try again.",
                status: 401,
            });
        }

        const { data, error } = exchangeResult;

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

            // Audit log: record the failed attempt for security visibility (prod only)
            if (getEnv("NODE_ENV") === "prod") {
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

        // Deleted / deletion-pending accounts must never obtain a session via
        // OAuth. The Supabase auth identity may still exist until the async
        // purge deletes it, so reject at the application layer and revoke the
        // just-created session immediately.
        if (!(await AccountDeletionService.isUserActive(user.id))) {
            try {
                await getSupabaseAdmin().auth.admin.signOut(
                    session.access_token,
                    "global",
                );
            } catch (err: any) {
                if (params.logContext) {
                    params.logContext.authWarning =
                        "Failed to revoke OAuth session for deleted account: " +
                        err.message;
                }
            }
            if (params.logContext) {
                params.logContext.oauthBlockedDeletedAccount = true;
            }
            throw new AppError({
                code: "FORBIDDEN",
                message:
                    "This account has been deleted. Please register a new account.",
                status: 403,
            });
        }

        // Resolve the tenant mapping. For a brand-new OAuth user the
        // public.users row may not exist yet when the callback runs (the
        // handle_verified_user DB trigger may fire late, or not at all for
        // OAuth users). Retry briefly, then provision from the app.
        const avatarUrl = user.identities?.[0]?.identity_data
            ?.avatar_url as string | undefined;

        const tenantId = await OAuthService.resolveUserTenantId({
            userId: user.id,
            email: user.email,
            avatarUrl,
            logContext: params.logContext,
        });

        if (tenantId) {
            // First-time OAuth login = account registration: send the one-time
            // welcome email. Checked BEFORE this login is written to
            // activity_logs below — any prior "auth.login" row means the
            // account already exists. Best-effort: a failure never breaks the
            // login, and the Redis NX claim dedupes concurrent first logins.
            try {
                const [priorLogins] = await db
                    .select({ total: count() })
                    .from(activityLogs)
                    .where(
                        and(
                            eq(activityLogs.userId, user.id),
                            eq(activityLogs.action, "auth.login"),
                        ),
                    );
                if (priorLogins.total === 0) {
                    await sendWelcomeEmailOnce({
                        email: user.email!,
                        userId: user.id,
                        requestId: params.requestId,
                        provider: params.provider,
                        logContext: params.logContext,
                    });
                }
            } catch (welcomeErr: any) {
                if (params.logContext) {
                    params.logContext.welcomeEmailError = welcomeErr.message;
                }
            }

            await logActivity({
                tenantId,
                userId: user.id,
                action: "auth.login",
                ipAddress: params.clientIp,
                userAgent: params.userAgent,
                requestId: params.requestId,
                metadata: { provider: params.provider },
            }, params.logContext);
        } else {
            if (params.logContext) {
                params.logContext.activityLogWarning =
                    `Could not log activity for OAuth user ${user.id}: user record not found in public.users`;
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

    /**
     * Resolves the user's tenantId after a successful OAuth login.
     *
     * Normally the `handle_verified_user` DB trigger creates the tenant and
     * public.users row. For OAuth users that row may not be visible yet when
     * the callback runs, or the trigger may never fire at all (OAuth emails
     * are already confirmed at insert time, so an UPDATE-based trigger skips
     * them). We retry the lookup briefly, then provision tenant + user + FREE
     * subscription from the app as a fallback so the session stays usable and
     * the login still lands in activity_logs.
     */
    private static async resolveUserTenantId(params: {
        userId: string;
        email?: string;
        avatarUrl?: string;
        logContext?: Record<string, any>;
    }): Promise<string | null> {
        const lookupTenantId = async (): Promise<string | null> => {
            // Only ACTIVE accounts count. A soft-deleted row must never be
            // resurrected by matching the same email — a deleted account is
            // terminal and re-registration provisions a brand-new tenant.
            const [byId] = await db
                .select({ tenantId: users.tenantId })
                .from(users)
                .where(
                    and(
                        eq(users.id, params.userId),
                        eq(users.deletionStatus, "active"),
                    ),
                );
            if (byId) return byId.tenantId;

            if (params.email) {
                const [byEmail] = await db
                    .select({ tenantId: users.tenantId })
                    .from(users)
                    .where(
                        and(
                            eq(users.email, params.email),
                            eq(users.deletionStatus, "active"),
                        ),
                    );
                if (byEmail) return byEmail.tenantId;
            }

            return null;
        };

        // 1. Retry briefly — the DB trigger may commit a moment after the
        //    code exchange completed.
        for (let attempt = 0; attempt < 3; attempt++) {
            const tenantId = await lookupTenantId();
            if (tenantId) return tenantId;
            if (attempt < 2) {
                await new Promise((resolve) => setTimeout(resolve, 200));
            }
        }

        // 2. Fallback provisioning — the trigger never fired for this user.
        //    A user without a tenant row is unusable (the auth middleware
        //    rejects them with 401), so create the records here instead of
        //    silently returning a broken session.
        if (!params.email) {
            return null;
        }

        if (params.logContext) {
            params.logContext.oauthFallbackProvisioned = true;
        }

        try {
            return await provisionTenantForUser({
                userId: params.userId,
                email: params.email,
                avatarUrl: params.avatarUrl,
                logContext: params.logContext,
            });
        } catch (err: any) {
            if (params.logContext) {
                params.logContext.oauthProvisioningError = err.message;
            }
            throw new AppError({
                code: "INTERNAL_ERROR",
                message:
                    "Failed to provision tenant for OAuth user. Please try again.",
                status: 500,
            });
        }
    }
}
