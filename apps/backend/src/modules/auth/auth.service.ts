import { AppError } from "../../shared/utils/errors.util.ts";
import { getSupabaseAdmin, getSupabaseAnon } from "../../config/supabase.ts";
import { getEnv } from "../../config/env.ts";
import { db, withAuthDb } from "../../config/drizzle.ts";
import { redis } from "../../config/redis.ts";
import {
    loginAttempts,
    users,
    tenants,
    tenantSubscriptions,
} from "../../shared/models/db.model.ts";
import { and, count, eq, gte } from "drizzle-orm";
import { verifyRecaptcha } from "../../shared/utils/recaptcha.util.ts";
import {
    sendVerificationEmail,
    sendRecoveryEmail,
    sendWelcomeEmailOnce,
} from "../../shared/utils/email.util.ts";
import * as AuthParams from "./auth.schema.ts";
import { AuthConstants } from "../../shared/constants/auth.constant.ts";
import { logActivity } from "../../shared/utils/activity.util.ts";
import { provisionTenantForUser } from "../../shared/utils/user_provision.util.ts";

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
        if (getEnv("NODE_ENV") === "prod") {
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
                            gte(
                                loginAttempts.attemptedAt,
                                new Date(windowStart),
                            ),
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
                const distinctUAs = new Set(
                    ipRegData.map((row) => row.userAgent),
                ).size;
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
        }

        // Step B.5: Marker key used by login cleanup and the resend path.
        // NOTE: no hard cooldown here anymore — a repeated registration for an
        // unconfirmed email is the ONLY way the user can request a fresh
        // verification link, and a hard block stranded re-registrations (e.g.
        // after account deletion) with no way to verify.
        const redisUnverifiedKey = `unverified_email:${params.email}`;

        // Step C: Create user and generate verification link via Supabase Auth Admin API
        const { data: linkData, error: signUpError } =
            await supabase.auth.admin.generateLink({
                type: "signup",
                email: params.email,
                password: params.password,
                options: {
                    redirectTo: getEnv("FRONTEND_URL"),
                },
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
                // The email already has an auth user. If it is still
                // UNCONFIRMED (the common case after re-registration), regenerate
                // the signup link and resend the verification email instead of
                // dead-ending the user — otherwise they can never verify and
                // can never log in with that email again.
                const { data: relink, error: relinkError } =
                    await supabase.auth.admin.generateLink({
                        type: "signup",
                        email: params.email,
                        password: params.password,
                        options: {
                            redirectTo: getEnv("FRONTEND_URL"),
                        },
                    });

                const isStillUnconfirmed =
                    relink?.user?.email_confirmed_at == null &&
                    relink?.user?.id != null;

                if (
                    !relinkError &&
                    isStillUnconfirmed &&
                    relink?.properties?.hashed_token
                ) {
                    const verifyUrl = `${getEnv("FRONTEND_URL")}/auth/verify?token_hash=${relink.properties.hashed_token}&type=signup`;

                    await sendVerificationEmail(
                        params.email,
                        verifyUrl,
                        relink.user.id,
                        params.requestId,
                        params.logContext,
                    );

                    try {
                        await redis.setex(redisUnverifiedKey, 86400, "1");
                    } catch (err: any) {
                        if (params.logContext) {
                            params.logContext.redisError = err.message;
                        }
                    }

                    if (params.logContext) {
                        params.logContext.authEvent = "verification_link_resent";
                    }

                    throw new AppError({
                        code: "VALIDATION_ERROR",
                        message:
                            "This email is registered but not verified yet. A new verification link has been sent — please check your inbox.",
                        status: 400,
                    });
                }

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
        if (linkData?.properties?.hashed_token && linkData?.user?.id) {
            const verifyUrl = `${getEnv("FRONTEND_URL")}/auth/verify?token_hash=${linkData.properties.hashed_token}&type=signup`;

            await sendVerificationEmail(
                params.email,
                verifyUrl,
                linkData.user.id,
                params.requestId,
                params.logContext,
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
                params.logContext.authError =
                    "Supabase Admin API did not return an action_link or user id.";
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

    static async verifyEmail(params: AuthParams.VerifyEmailParams) {
        const authClient = getSupabaseAnon();

        const { data: authData, error } = await authClient.auth.verifyOtp({
            token_hash: params.tokenHash,
            type: params.type as any,
        });

        if (error || !authData.session || !authData.user) {
            if (params.logContext) {
                params.logContext.authEvent = "verify_email_failed";
                params.logContext.authError =
                    error?.message ?? "no session returned";
            }

            throw new AppError({
                code: "UNAUTHORIZED",
                message: "Invalid or expired verification link.",
                status: 401,
            });
        }

        const user = authData.user;
        const session = authData.session;

        if (params.logContext) {
            params.logContext.authEvent = "verify_email_success";
            params.logContext.userId = user.id;
        }

        // The handle_verified_user trigger normally creates the tenant + user
        // row when email_confirmed_at is set. If it was missed, self-heal here.
        let [userRecord] = await db
            .select({ tenantId: users.tenantId })
            .from(users)
            .where(eq(users.id, user.id));
        if (!userRecord) {
            const provisionedTenantId = await provisionTenantForUser({
                userId: user.id,
                email: user.email ?? "",
                logContext: params.logContext,
            });
            if (provisionedTenantId) {
                userRecord = { tenantId: provisionedTenantId };
            }
        }

        if (userRecord) {
            await logActivity({
                tenantId: userRecord.tenantId,
                userId: user.id,
                action: "auth.register",
                metadata: { type: "email_verification" },
                ipAddress: params.clientIp,
                userAgent: params.userAgent,
                requestId: params.requestId,
            }, params.logContext);
        }

        // Send Welcome notification upon successful first-time email verification
        if (user.email) {
            try {
                await sendWelcomeEmailOnce({
                    email: user.email,
                    userId: user.id,
                    requestId: params.requestId,
                    provider: "email",
                    logContext: params.logContext,
                });
            } catch (welcomeErr: any) {
                if (params.logContext) {
                    params.logContext.authWarning =
                        "Welcome email failed (non-fatal): " + welcomeErr.message;
                }
            }
        }

        return { session, user };
    }

    static async loginUser(params: AuthParams.LoginParams) {
        // Step A: Verify reCAPTCHA
        await verifyRecaptcha({
            token: params.recaptchaToken,
            remoteIp: params.clientIp,
            expectedAction: "login",
        });

        // Step B & C: Lockout & Anti-Bruteforce checks (Prod only)
        if (getEnv("NODE_ENV") === "prod") {
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
                        .set({
                            isLocked: false,
                            lockedUntil: null,
                            updatedAt: new Date(),
                        })
                        .where(eq(users.email, params.email));
                }
            }

            const windowStart = new Date(
                Date.now() - AuthConstants.LOCKOUT_WINDOW_MINUTES * 60 * 1000,
            ).toISOString();

            let ipFailData: any[] = [];
            try {
                ipFailData = await db
                    .select({ userAgent: loginAttempts.userAgent })
                    .from(loginAttempts)
                    .where(
                        and(
                            eq(loginAttempts.ipAddress, params.clientIp),
                            eq(loginAttempts.isSuccess, false),
                            gte(
                                loginAttempts.attemptedAt,
                                new Date(windowStart),
                            ),
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
                const distinctUAs = new Set(
                    ipFailData.map((row) => row.userAgent),
                ).size;
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

            let emailFailCount = 0;
            try {
                const result = await db
                    .select({ count: count() })
                    .from(loginAttempts)
                    .where(
                        and(
                            eq(loginAttempts.emailAttempted, params.email),
                            eq(loginAttempts.isSuccess, false),
                            gte(
                                loginAttempts.attemptedAt,
                                new Date(windowStart),
                            ),
                        ),
                    );
                emailFailCount = result[0].count;
            } catch (emailCountError: any) {
                if (params.logContext) {
                    params.logContext.authEvent =
                        "email_rate_limit_check_failed";
                    params.logContext.authError = emailCountError.message;
                }
            }

            if (emailFailCount >= AuthConstants.MAX_FAILED_ATTEMPTS) {
                const lockUntilDate = new Date(
                    Date.now() +
                        AuthConstants.LOCKOUT_DURATION_MINUTES * 60 * 1000,
                );

                await db
                    .update(users)
                    .set({
                        isLocked: true,
                        lockedUntil: lockUntilDate,
                        updatedAt: new Date(),
                    })
                    .where(eq(users.email, params.email));

                throw new AppError({
                    code: "RATE_LIMIT_EXCEEDED",
                    message:
                        "Too many failed login attempts, account has been locked for 15 minutes",
                    status: 429,
                    retryAfter: AuthConstants.LOCKOUT_DURATION_MINUTES * 60,
                });
            }
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
            // Supabase hides the real reason behind a generic message. Surface
            // the "email not confirmed" case explicitly — it is the most common
            // blocker after (re-)registration, e.g. an account that was deleted
            // and then re-registered with the same email.
            const isUnconfirmed =
                authError?.code === "email_not_confirmed" ||
                (authError?.message ?? "")
                    .toLowerCase()
                    .includes("not confirmed");

            if (isUnconfirmed) {
                if (params.logContext) {
                    params.logContext.authEvent = "login_failed_email_not_confirmed";
                }
                throw new AppError({
                    code: "VALIDATION_ERROR",
                    message:
                        "Your email is not verified yet. Check your inbox for the verification link, or try registering again to resend it.",
                    status: 400,
                });
            }

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

        // Deleted / deletion-pending accounts must never log back in. Supabase
        // still accepts the password until the async purge deletes the auth
        // identity, so reject at the application layer and revoke the session
        // the moment it is created — otherwise the user gets a 200 login + valid
        // cookies for an account that is already gone.
        let [userRecord] = await db
            .select({
                tenantId: users.tenantId,
                deletionStatus: users.deletionStatus,
            })
            .from(users)
            .where(eq(users.id, authData.user.id));

        // The handle_verified_user trigger may have been missed (late or never
        // fired). Self-heal: provision the tenant + FREE subscription now, the
        // same way the OAuth fallback does, so login never lands in "session
        // exists but no tenant" limbo.
        if (!userRecord) {
            const provisionedTenantId = await provisionTenantForUser({
                userId: authData.user.id,
                email: authData.user.email ?? params.email,
                logContext: params.logContext,
            });
            if (!provisionedTenantId) {
                throw new AppError({
                    code: "INTERNAL_ERROR",
                    message:
                        "Failed to initialize your account. Please try again.",
                    status: 500,
                });
            }
            userRecord = {
                tenantId: provisionedTenantId,
                deletionStatus: "active",
            };
        }

        if (userRecord.deletionStatus !== "active") {
            try {
                await getSupabaseAdmin().auth.admin.signOut(
                    authData.session.access_token,
                    "global",
                );
            } catch (err: any) {
                if (params.logContext) {
                    params.logContext.authWarning =
                        "Failed to revoke session for deleted account: " + err.message;
                }
            }
            if (params.logContext) {
                params.logContext.authEvent = "login_blocked_deleted_account";
            }
            throw new AppError({
                code: "FORBIDDEN",
                message:
                    "This account has been deleted. Please register a new account.",
                status: 403,
            });
        }

        await logActivity({
            tenantId: userRecord.tenantId,
            userId: authData.user.id,
            action: "auth.login",
            ipAddress: params.clientIp,
            userAgent: params.userAgent,
            requestId: params.requestId,
            metadata: { provider: "email" },
        }, params.logContext);

        // Cleanup: Remove the unverified email cooldown cache since user is now verified and logged in
        try {
            await redis.del(`unverified_email:${params.email}`);
        } catch (err: any) {
            if (params.logContext) {
                params.logContext.redisError =
                    "Failed to clean up unverified email cache: " + err.message;
            }
        }

        return authData;
    }

    private static async logLoginAttempt(
        params: AuthParams.LoginAttemptParams,
    ): Promise<void> {
        if (getEnv("NODE_ENV") !== "prod") {
            return;
        }
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
        if (getEnv("NODE_ENV") === "prod") {
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
                            gte(
                                loginAttempts.attemptedAt,
                                new Date(windowStart),
                            ),
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
        }

        // Step C: Verify that an active, verified user exists in the database.
        // In Dokyudo, accounts only exist in public.users once verified with a tenant.
        // If the user does not exist or is unverified/deleted, exit silently to prevent email enumeration.
        let existingUser: { id: string } | undefined;
        try {
            const [userRecord] = await db
                .select({ id: users.id })
                .from(users)
                .where(
                    and(
                        eq(users.email, params.email),
                        eq(users.deletionStatus, "active"),
                    ),
                )
                .limit(1);
            existingUser = userRecord;
        } catch (dbErr: any) {
            if (params.logContext) {
                params.logContext.authEvent = "forget_password_db_error";
                params.logContext.authError = dbErr.message;
            }
            throw new AppError({
                code: "INTERNAL_ERROR",
                message:
                    "Failed to process password recovery. Please try again later.",
                status: 500,
            });
        }

        if (!existingUser) {
            if (params.logContext) {
                params.logContext.authEvent =
                    "forget_password_user_not_found";
                params.logContext.authEmail = params.email;
            }
            return; // Return silently to prevent email enumeration
        }

        // Step D: Generate Recovery Link via Supabase Admin API
        const { data: linkData, error: recoveryError } =
            await supabase.auth.admin.generateLink({
                type: "recovery",
                email: params.email,
                options: {
                    redirectTo: `${getEnv("FRONTEND_URL")}/forget-password/update-password`,
                },
            });

        // Step E: Log attempt
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

        // Step F: Send Email
        if (linkData && linkData.properties) {
            const recoveryUrl = linkData.properties.email_otp
                ? `${getEnv("FRONTEND_URL")}/forget-password/update-password?otp=${linkData.properties.email_otp}&email=${encodeURIComponent(params.email)}`
                : linkData.properties.hashed_token
                ? `${getEnv("FRONTEND_URL")}/forget-password/update-password?token_hash=${linkData.properties.hashed_token}&email=${encodeURIComponent(params.email)}`
                : linkData.properties.action_link;

            await sendRecoveryEmail(
                params.email,
                recoveryUrl,
                linkData.properties.email_otp,
                params.requestId,
                params.logContext,
            );
        }

        if (params.logContext)
            params.logContext.authEvent = "forget_password_success";
    }

    static async resetPassword(params: AuthParams.ResetPasswordParams) {
        const supabase = getSupabaseAnon();

        const isTokenHash = params.otp.length > 20;

        const { data, error } = isTokenHash
            ? await supabase.auth.verifyOtp({
                  token_hash: params.otp,
                  type: "recovery",
              })
            : await supabase.auth.verifyOtp({
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

        const [userRecord] = await db
            .select({ tenantId: users.tenantId })
            .from(users)
            .where(eq(users.id, data.user.id));
        if (userRecord) {
            await logActivity({
                tenantId: userRecord.tenantId,
                userId: data.user.id,
                action: "auth.password_reset",
                ipAddress: params.clientIp,
                userAgent: params.userAgent,
                requestId: params.requestId,
                metadata: { type: "otp_reset" },
            }, params.logContext);
        }
    }
}
