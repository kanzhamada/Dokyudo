import { AppError } from "../../shared/utils/errors.util.ts";
import { getSupabaseAdmin, getSupabaseAnon } from "../../config/supabase.ts";
import { db, withAuthDb } from "../../config/drizzle.ts";
import { redis } from "../../config/redis.ts";
import { loginAttempts, users, tenants, tenantSubscriptions } from "../../shared/models/db.model.ts";
import { and, count, eq, gte } from "drizzle-orm";
import { verifyRecaptcha } from "../../shared/utils/recaptcha.util.ts";
import {
    sendVerificationEmail,
    sendRecoveryEmail,
} from "../../shared/utils/email.util.ts";
import * as AuthParams from "./auth.schema.ts";
import { AuthConstants } from "../../shared/constants/auth.constant.ts";
import { logActivity } from "../../shared/utils/activity.util.ts";

export class AuthService {
    static async registerUser(params: AuthParams.RegisterParams) {
        // Step A: Verify reCAPTCHA v3 token
        await verifyRecaptcha({
            token: params.recaptchaToken,
            remoteIp: params.clientIp,
            expectedAction: "register",
        });

        const supabase = getSupabaseAdmin();
        const windowStart = new Date(
            Date.now() - AuthConstants.LOCKOUT_WINDOW_MINUTES * 60 * 1000,
        ).toISOString();

        // Step B: Per-IP Rate Limiting & User-Agent Anomaly Detection
        let ipRegData: any[] = [];
        try {
            ipRegData = await db
                .select({
                    userAgent: loginAttempts.userAgent,
                    isSuccess: loginAttempts.isSuccess,
                })
                .from(loginAttempts)
                .where(
                    and(
                        eq(loginAttempts.ipAddress, params.clientIp),
                        eq(loginAttempts.authProvider, "register"),
                        gte(loginAttempts.attemptedAt, new Date(windowStart)),
                    ),
                )
                .limit(21);
        } catch (ipCountError: any) {
            if (params.logContext) {
                params.logContext.authEvent = "ip_rate_limit_check_failed";
                params.logContext.authError = ipCountError.message;
            }
        }

        if (ipRegData && ipRegData.length > 0) {
            const distinctUAs = new Set(ipRegData.map((row) => row.userAgent))
                .size;
            const successCount = ipRegData.filter(
                (row) => row.isSuccess,
            ).length;

            const isBotAnomaly = distinctUAs > 3;
            const ipLimit = isBotAnomaly ? 3 : 20;

            if (ipRegData.length >= ipLimit || successCount >= 5) {
                if (params.logContext) {
                    params.logContext.authEvent = "ip_blocked";
                    params.logContext.totalAttempts = ipRegData.length;
                    params.logContext.successCount = successCount;
                    params.logContext.anomalyDetected = isBotAnomaly;
                }

                throw new AppError({
                    code: "RATE_LIMIT_EXCEEDED",
                    message:
                        "Too many registration attempts from this IP address, please try again later",
                    status: 429,
                    retryAfter: AuthConstants.LOCKOUT_DURATION_MINUTES * 60,
                });
            }
        }

        // Step B.5: Check if email is already waiting for verification in Redis (to save Resend cost)
        const redisUnverifiedKey = `unverified_email:${params.email}`;
        let isUnverifiedCooldown = false;
        try {
            isUnverifiedCooldown =
                (await redis.exists(redisUnverifiedKey)) === 1;
        } catch (err: any) {
            if (params.logContext) {
                params.logContext.redisError = err.message;
            }
        }

        if (isUnverifiedCooldown) {
            throw new AppError({
                code: "VALIDATION_ERROR",
                message:
                    "Account already registered. Please check your email inbox to verify your account.",
                status: 400,
            });
        }

        // Step C: Create user and generate verification link via Supabase Auth Admin API
        const { data: linkData, error: signUpError } =
            await supabase.auth.admin.generateLink({
                type: "signup",
                email: params.email,
                password: params.password,
            });

        // Step D: Log registration attempt (success or failure) for rate-limiting calculations
        await AuthService.logLoginAttempt({
            email: params.email,
            ipAddress: params.clientIp,
            userAgent: params.userAgent,
            isSuccess: !signUpError,
            authProvider: "register",
            logContext: params.logContext,
        });

        if (signUpError) {
            if (
                signUpError.message
                    ?.toLowerCase()
                    .includes("already registered") ||
                signUpError.message
                    ?.toLowerCase()
                    .includes("already been registered") ||
                signUpError.message
                    ?.toLowerCase()
                    .includes("user already exists") ||
                signUpError.status === 422
            ) {
                throw new AppError({
                    code: "VALIDATION_ERROR",
                    message: "An account with this email already exists",
                    status: 400,
                });
            }

            if (params.logContext) {
                params.logContext.authEvent = "registration_failed";
                params.logContext.authError = signUpError.message;
            }

            throw new AppError({
                code: "INTERNAL_ERROR",
                message: "Registration failed, please try again later",
                status: 500,
            });
        }

        // Step E: Prevent re-registration if already verified
        const isAlreadyVerified =
            linkData?.user?.email_confirmed_at != null ||
            linkData?.user?.identities?.[0]?.identity_data?.email_verified ===
                true;

        if (isAlreadyVerified) {
            throw new AppError({
                code: "VALIDATION_ERROR",
                message: "An account with this email already exists",
                status: 400,
            });
        }

        // Step F: Send Verification Email via Resend
        if (linkData?.properties?.action_link && linkData?.user?.id) {
            await sendVerificationEmail(
                params.email,
                linkData.properties.action_link,
                linkData.user.id,
                params.requestId,
            );

            // Cache the unverified state to prevent resends for 24 hours (86400s), matching Supabase's link expiry
            try {
                await redis.setex(redisUnverifiedKey, 86400, "1");
            } catch (err: any) {
                if (params.logContext) {
                    params.logContext.redisError = err.message;
                }
            }
        } else {
            if (params.logContext) {
                params.logContext.authError = "Supabase Admin API did not return an action_link or user id.";
            }
            throw new AppError({
                code: "INTERNAL_ERROR",
                message:
                    "Registration failed during email generation, please try again later",
                status: 500,
            });
        }

        if (params.logContext) {
            params.logContext.authEvent = "user_registered";
            params.logContext.authEmail = params.email;
        }
    }

    static async loginUser(params: AuthParams.LoginParams) {
        // Step A: Verify reCAPTCHA
        await verifyRecaptcha({
            token: params.recaptchaToken,
            remoteIp: params.clientIp,
            expectedAction: "login",
        });

        // Step B: Lockout check
        let lockedUser = null;
        try {
            const result = await db
                .select({
                    isLocked: users.isLocked,
                    lockedUntil: users.lockedUntil,
                })
                .from(users)
                .where(eq(users.email, params.email))
                .limit(1);
            if (result.length > 0) {
                lockedUser = result[0];
            }
        } catch (lockCheckError: any) {
            if (params.logContext) {
                params.logContext.authEvent = "lockout_check_failed";
                params.logContext.authError = lockCheckError.message;
            }
        }

        if (lockedUser) {
            const isLocked = lockedUser.isLocked === true;
            const lockExpiry = lockedUser.lockedUntil
                ? new Date(lockedUser.lockedUntil)
                : null;
            const now = new Date();

            if (isLocked && lockExpiry && lockExpiry > now) {
                throw new AppError({
                    code: "FORBIDDEN",
                    message:
                        "Account is temporarily locked due to too many failed login attempts, please try again later",
                    status: 403,
                });
            }

            if (isLocked && lockExpiry && lockExpiry <= now) {
                await db
                    .update(users)
                    .set({ isLocked: false, lockedUntil: null, updatedAt: new Date() })
                    .where(eq(users.email, params.email));
            }
        }

        // Step C: Advanced Anti-Bruteforce & Correlation Logic
        const windowStart = new Date(
            Date.now() - AuthConstants.LOCKOUT_WINDOW_MINUTES * 60 * 1000,
        ).toISOString();

        // 1. Per-IP Rate Limiting & User-Agent Anomaly Detection
        let ipFailData: any[] = [];
        try {
            ipFailData = await db
                .select({ userAgent: loginAttempts.userAgent })
                .from(loginAttempts)
                .where(
                    and(
                        eq(loginAttempts.ipAddress, params.clientIp),
                        eq(loginAttempts.isSuccess, false),
                        gte(loginAttempts.attemptedAt, new Date(windowStart)),
                    ),
                )
                .limit(21);
        } catch (ipCountError: any) {
            if (params.logContext) {
                params.logContext.authEvent = "ip_rate_limit_check_failed";
                params.logContext.authError = ipCountError.message;
            }
        }

        if (ipFailData && ipFailData.length > 0) {
            const distinctUAs = new Set(ipFailData.map((row) => row.userAgent))
                .size;
            // If an IP rotates > 3 User-Agents, it's highly indicative of a botnet/script
            const isBotAnomaly = distinctUAs > 3;
            const ipLimit = isBotAnomaly ? 3 : 20;

            if (ipFailData.length >= ipLimit) {
                if (params.logContext) {
                    params.logContext.authEvent = "ip_blocked";
                    params.logContext.failedAttempts = ipFailData.length;
                    params.logContext.anomalyDetected = isBotAnomaly;
                }

                throw new AppError({
                    code: "RATE_LIMIT_EXCEEDED",
                    message:
                        "Too many login attempts from this IP address, please try again later",
                    status: 429,
                    retryAfter: AuthConstants.LOCKOUT_DURATION_MINUTES * 60,
                });
            }
        }

        // 2. Per-Email Distributed Attack Lockout (Password Spraying)
        let emailFailCount = 0;
        try {
            const result = await db
                .select({ count: count() })
                .from(loginAttempts)
                .where(
                    and(
                        eq(loginAttempts.emailAttempted, params.email),
                        eq(loginAttempts.isSuccess, false),
                        gte(loginAttempts.attemptedAt, new Date(windowStart)),
                    ),
                );
            emailFailCount = result[0].count;
        } catch (emailCountError: any) {
            if (params.logContext) {
                params.logContext.authEvent = "email_rate_limit_check_failed";
                params.logContext.authError = emailCountError.message;
            }
        }

        if (emailFailCount >= AuthConstants.MAX_FAILED_ATTEMPTS) {
            const lockUntilDate = new Date(
                Date.now() + AuthConstants.LOCKOUT_DURATION_MINUTES * 60 * 1000,
            );

            await db
                .update(users)
                .set({ isLocked: true, lockedUntil: lockUntilDate, updatedAt: new Date() })
                .where(eq(users.email, params.email));

            throw new AppError({
                code: "RATE_LIMIT_EXCEEDED",
                message:
                    "Too many failed login attempts, account has been locked for 15 minutes",
                status: 429,
                retryAfter: AuthConstants.LOCKOUT_DURATION_MINUTES * 60,
            });
        }

        // Step D: Auth
        const authClient = getSupabaseAnon();
        const { data: authData, error: authError } =
            await authClient.auth.signInWithPassword({
                email: params.email,
                password: params.password,
            });

        const isSuccess = !authError && !!authData?.session;

        await AuthService.logLoginAttempt({
            email: params.email,
            ipAddress: params.clientIp,
            userAgent: params.userAgent,
            isSuccess,
            logContext: params.logContext,
        });

        if (authError || !authData?.session) {
            if (params.logContext) {
                params.logContext.authEvent = "login_failed";
                params.logContext.authEmail = params.email;
                params.logContext.authError =
                    authError?.message ?? "no session returned";
            }

            throw new AppError({
                code: "UNAUTHORIZED",
                message: "Invalid email or password",
                status: 401,
            });
        }

        if (params.logContext) {
            params.logContext.authEvent = "login_success";
            params.logContext.authEmail = params.email;
            params.logContext.userId = authData.user.id;
        }

        const [userRecord] = await db.select({ tenantId: users.tenantId }).from(users).where(eq(users.id, authData.user.id));
        if (userRecord) {
            logActivity({
                tenantId: userRecord.tenantId,
                userId: authData.user.id,
                action: "auth.login",
                ipAddress: params.clientIp,
                userAgent: params.userAgent,
                requestId: params.requestId,
                metadata: { provider: "email" },
            });
        }

        // Cleanup: Remove the unverified email cooldown cache since user is now verified and logged in
        try {
            await redis.del(`unverified_email:${params.email}`);
        } catch (err: any) {
            if (params.logContext) {
                params.logContext.redisError = "Failed to clean up unverified email cache: " + err.message;
            }
        }

        return authData;
    }

    private static async logLoginAttempt(
        params: AuthParams.LoginAttemptParams,
    ): Promise<void> {
        try {
            await db.insert(loginAttempts).values({
                emailAttempted: params.email,
                ipAddress: params.ipAddress,
                userAgent: params.userAgent,
                isSuccess: params.isSuccess,
                authProvider: params.authProvider ?? "email",
            });
        } catch (error: any) {
            if (params.logContext) {
                params.logContext.dbError_logLoginAttempt = error.message;
            }
        }
    }

    static async logoutUser(params: AuthParams.LogoutParams) {
        const supabase = getSupabaseAdmin();
        const { data: userData } = await supabase.auth.getUser(params.accessToken);
        
        const { error } = await supabase.auth.admin.signOut(
            params.accessToken,
            "global",
        );

        if (error) {
            // If the token is already expired or invalid, we consider the logout successful
            // to provide an idempotent, error-free experience for the frontend.
            const isExpiredOrInvalid =
                error.message.toLowerCase().includes("jwt") ||
                error.message.toLowerCase().includes("token") ||
                error.message.toLowerCase().includes("expired") ||
                error.message.toLowerCase().includes("invalid");

            if (isExpiredOrInvalid) {
                if (params.logContext) {
                    params.logContext.authEvent = "logout_success_idempotent";
                    params.logContext.authNote = error.message;
                }
                return; // Treat as success
            }

            if (params.logContext) {
                params.logContext.authEvent = "logout_failed";
                params.logContext.authError = error.message;
            }
            throw new AppError({
                code: "INTERNAL_ERROR",
                message: "Failed to sign out",
                status: 500,
            });
        }

        if (params.logContext) {
            params.logContext.authEvent = "logout_success";
        }
        
        if (userData?.user?.id) {
            const [userRecord] = await db.select({ tenantId: users.tenantId }).from(users).where(eq(users.id, userData.user.id));
            if (userRecord) {
                logActivity({
                    tenantId: userRecord.tenantId,
                    userId: userData.user.id,
                    action: "auth.logout",
                });
            }
        }
    }

    static async forgetPassword(params: AuthParams.ForgetPasswordParams) {
        // Step A: Verify reCAPTCHA v3 token
        await verifyRecaptcha({
            token: params.recaptchaToken,
            remoteIp: params.clientIp,
            expectedAction: "forget_password",
        });

        const supabase = getSupabaseAdmin();
        const windowStart = new Date(
            Date.now() - AuthConstants.LOCKOUT_WINDOW_MINUTES * 60 * 1000,
        ).toISOString();

        // Step B: Basic Per-IP Rate Limiting for recovery requests
        try {
            const ipRegData = await db
                .select({
                    userAgent: loginAttempts.userAgent,
                })
                .from(loginAttempts)
                .where(
                    and(
                        eq(loginAttempts.ipAddress, params.clientIp),
                        eq(loginAttempts.authProvider, "forget_password"),
                        gte(loginAttempts.attemptedAt, new Date(windowStart)),
                    ),
                )
                .limit(5);

            if (ipRegData.length >= 5) {
                throw new AppError({
                    code: "RATE_LIMIT_EXCEEDED",
                    message:
                        "Too many password recovery requests from this IP. Please try again later.",
                    status: 429,
                    retryAfter: AuthConstants.LOCKOUT_DURATION_MINUTES * 60,
                });
            }
        } catch (err: any) {
            if (err instanceof AppError) throw err;
            if (params.logContext) {
                params.logContext.authError = err.message;
            }
        }

        // Step C: Generate Recovery Link via Supabase Admin API
        const { data: linkData, error: recoveryError } =
            await supabase.auth.admin.generateLink({
                type: "recovery",
                email: params.email,
            });

        // Step D: Log attempt
        await AuthService.logLoginAttempt({
            email: params.email,
            ipAddress: params.clientIp,
            userAgent: params.userAgent,
            isSuccess: !recoveryError,
            authProvider: "forget_password",
            logContext: params.logContext,
        });

        // Silently ignore "user not found" to prevent email enumeration
        if (recoveryError) {
            if (
                recoveryError.status === 404 ||
                recoveryError.status === 422 ||
                recoveryError.message?.toLowerCase().includes("not found")
            ) {
                if (params.logContext)
                    params.logContext.authEvent =
                        "forget_password_user_not_found";
                return; // Return silently
            }

            throw new AppError({
                code: "INTERNAL_ERROR",
                message:
                    "Failed to process password recovery. Please try again later.",
                status: 500,
            });
        }

        // Step E: Send Email
        if (linkData && linkData.properties) {
            await sendRecoveryEmail(
                params.email,
                linkData.properties.action_link,
                linkData.properties.email_otp,
                params.requestId,
            );
        }

        if (params.logContext)
            params.logContext.authEvent = "forget_password_success";
    }

    static async resetPassword(params: AuthParams.ResetPasswordParams) {
        const supabase = getSupabaseAnon();

        // Verify OTP using Supabase anonymous client
        const { data, error } = await supabase.auth.verifyOtp({
            email: params.email,
            token: params.otp,
            type: "recovery",
        });

        if (error || !data.user) {
            if (params.logContext) {
                params.logContext.authEvent = "reset_password_failed";
                params.logContext.authError = error?.message;
            }
            throw new AppError({
                code: "UNAUTHORIZED",
                message:
                    "Invalid or expired OTP. Please request a new password reset link.",
                status: 401,
            });
        }

        // Update password using Admin API
        const adminSupabase = getSupabaseAdmin();

        try {
            const { error: updateError } =
                await adminSupabase.auth.admin.updateUserById(data.user.id, {
                    password: params.newPassword,
                });

            if (updateError) {
                if (params.logContext) {
                    params.logContext.authError = updateError.message;
                }
                throw new AppError({
                    code: "INTERNAL_ERROR",
                    message: "Failed to update password. Please try again.",
                    status: 500,
                });
            }
        } catch (e: any) {
            if (e instanceof AppError) throw e;
            if (params.logContext) {
                params.logContext.authError = e.message;
            }
            throw new AppError({
                code: "INTERNAL_ERROR",
                message: "Failed to update password. Please try again.",
                status: 500,
            });
        }

        // Since they used OTP, they might have gotten an implicit session from verifyOtp.
        // Let's force re-login by killing any existing sessions.
        try {
            await adminSupabase.auth.admin.signOut(
                data.session?.access_token || "",
                "global",
            );
        } catch (e) {
            // ignore
        }

        if (params.logContext) {
            params.logContext.authEvent = "reset_password_success";
            params.logContext.userId = data.user.id;
        }

        const [userRecord] = await db.select({ tenantId: users.tenantId }).from(users).where(eq(users.id, data.user.id));
        if (userRecord) {
            logActivity({
                tenantId: userRecord.tenantId,
                userId: data.user.id,
                action: "auth.password_reset",
                ipAddress: params.clientIp,
                userAgent: params.userAgent,
                requestId: params.requestId,
                metadata: { type: "otp_reset" },
            });
        }
    }

    static async updatePassword(params: AuthParams.UpdatePasswordParams) {
        const supabase = getSupabaseAnon();

        // Validate the provided access token
        const { data, error } = await supabase.auth.getUser(params.accessToken);

        if (error || !data.user) {
            throw new AppError({
                code: "UNAUTHORIZED",
                message: "Invalid or expired session. Please log in again.",
                status: 401,
            });
        }

        const adminSupabase = getSupabaseAdmin();

        // Update the user's password
        try {
            const { error: updateError } =
                await adminSupabase.auth.admin.updateUserById(data.user.id, {
                    password: params.newPassword,
                });

            if (updateError) {
                if (params.logContext) {
                    params.logContext.authError = updateError.message;
                }
                throw new AppError({
                    code: "INTERNAL_ERROR",
                    message: "Failed to update password.",
                    status: 500,
                });
            }
        } catch (e: any) {
            if (e instanceof AppError) throw e;
            if (params.logContext) {
                params.logContext.authError = e.message;
            }
            throw new AppError({
                code: "INTERNAL_ERROR",
                message: "Failed to update password.",
                status: 500,
            });
        }

        // Force re-login: Invalidate all sessions globally for this user
        try {
            await adminSupabase.auth.admin.signOut(
                params.accessToken,
                "global",
            );
        } catch (signOutErr: any) {
            if (params.logContext) {
                params.logContext.authWarning = "Failed to sign out after password update: " + signOutErr.message;
            }
        }

        if (params.logContext) {
            params.logContext.authEvent = "update_password_success";
            params.logContext.userId = data.user.id;
        }

        const [userRecord] = await db.select({ tenantId: users.tenantId }).from(users).where(eq(users.id, data.user.id));
        if (userRecord) {
            logActivity({
                tenantId: userRecord.tenantId,
                userId: data.user.id,
                action: "auth.password_reset",
                metadata: { type: "update_password" },
            });
        }
    }

    static async getProfile(params: { userId: string, tenantId: string, logContext?: any }) {
        const [userRecord] = await db
            .select()
            .from(users)
            .where(eq(users.id, params.userId));

        if (!userRecord) {
            throw new AppError({
                code: "NOT_FOUND",
                message: "User not found",
                status: 404,
            });
        }

        const [tenantRecord] = await db
            .select()
            .from(tenants)
            .where(eq(tenants.id, params.tenantId));

        if (!tenantRecord) {
            throw new AppError({
                code: "NOT_FOUND",
                message: "Tenant not found",
                status: 404,
            });
        }

        const [subscription] = await db
            .select()
            .from(tenantSubscriptions)
            .where(eq(tenantSubscriptions.tenantId, params.tenantId));

        if (!subscription) {
            throw new AppError({
                code: "NOT_FOUND",
                message: "Subscription not found",
                status: 404,
            });
        }

        let currentTier = subscription.tier;
        let expiresAt = subscription.expiresAt;

        // Lazy Evaluation: Auto-Downgrade
        if (expiresAt && new Date() > expiresAt && currentTier !== "FREE") {
            currentTier = "FREE";
            expiresAt = null;

            await db
                .update(tenantSubscriptions)
                .set({
                    tier: "FREE",
                    expiresAt: null,
                    updatedAt: new Date(),
                })
                .where(eq(tenantSubscriptions.tenantId, params.tenantId));
            
            if (params.logContext) {
                params.logContext.authEvent = "tier_auto_downgraded";
                params.logContext.oldTier = subscription.tier;
            }
        }

        return {
            user: {
                id: userRecord.id,
                email: userRecord.email,
                profilePictureUrl: userRecord.profilePictureUrl,
            },
            tenant: {
                id: tenantRecord.id,
                name: tenantRecord.name,
            },
            subscription: {
                tier: currentTier,
                expiresAt: expiresAt?.toISOString() || null,
                uploadsCount: subscription.uploadsCount,
                searchesCount: subscription.searchesCount,
                qaCount: subscription.qaCount,
                storageUsedBytes: subscription.storageUsedBytes,
            },
        };
    }

    static async updateTenantName(params: {
        userId: string;
        tenantId: string;
        name: string;
        logContext?: Record<string, any>;
    }) {
        const updated = await withAuthDb(params.userId, async (tx) => {
            const [existing] = await tx
                .select({ id: tenants.id })
                .from(tenants)
                .where(eq(tenants.id, params.tenantId));

            if (!existing) {
                throw new AppError({
                    code: "VALIDATION_ERROR",
                    message: "Tenant not found",
                    status: 404,
                });
            }

            const [result] = await tx
                .update(tenants)
                .set({ name: params.name, updatedAt: new Date() })
                .where(eq(tenants.id, params.tenantId))
                .returning({ id: tenants.id, name: tenants.name });

            return result;
        });

        if (params.logContext) {
            params.logContext.authEvent = "tenant_name_updated";
        }

        logActivity({
            tenantId: params.tenantId,
            userId: params.userId,
            action: "tenant.name_updated",
            metadata: { newName: updated.name },
            requestId: params.logContext?.requestId,
        });

        return {
            tenant: {
                id: updated.id,
                name: updated.name,
            },
            message: "Tenant name updated successfully.",
        };
    }
}
