import { AppError } from "../../shared/utils/errors.util.ts";
import { getSupabaseAdmin, getSupabaseAuth } from "../../config/supabase.ts";
import { db } from "../../config/drizzle.ts";
import { loginAttempts } from "../../shared/models/db.model.ts";
import { verifyRecaptcha } from "../../shared/utils/recaptcha.util.ts";
import { LoginAttemptParams, LoginParams, RegisterParams } from "../../shared/types/auth.types.ts";

const LOCKOUT_WINDOW_MINUTES = 15;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

export async function registerUser(params: RegisterParams) {
    // Step A: Verify reCAPTCHA v3 token
    await verifyRecaptcha({
        token: params.recaptchaToken,
        remoteIp: params.clientIp,
        expectedAction: "register",
    });

    // Step B: Create user via Supabase Auth Admin API
    const supabase = getSupabaseAdmin();
    const { error: signUpError } = await supabase.auth.admin.createUser({
        email: params.email,
        password: params.password,
        email_confirm: false, // User must verify via email link
    });

    if (signUpError) {
        if (signUpError.message?.toLowerCase().includes("already registered") ||
            signUpError.message?.toLowerCase().includes("already been registered") ||
            signUpError.status === 422) {
            throw new AppError({
                code: "VALIDATION_ERROR",
                message: "An account with this email already exists",
                status: 400,
            });
        }

        console.error(
            JSON.stringify({
                requestId: params.requestId,
                event: "registration_failed",
                email: params.email,
                error: signUpError.message,
            })
        );

        throw new AppError({
            code: "INTERNAL_ERROR",
            message: "Registration failed. Please try again later.",
            status: 500,
        });
    }

    console.log(
        JSON.stringify({
            requestId: params.requestId,
            event: "user_registered",
            email: params.email,
            ip: params.clientIp,
        })
    );
}

export async function loginUser(params: LoginParams) {
    const supabase = getSupabaseAdmin();

    // Step A: Verify reCAPTCHA
    await verifyRecaptcha({
        token: params.recaptchaToken,
        remoteIp: params.clientIp,
        expectedAction: "login",
    });

    // Step B: Lockout check
    const { data: lockedUser, error: lockCheckError } = await supabase
        .from("users")
        .select("is_locked, locked_until")
        .eq("email", params.email)
        .maybeSingle();

    if (lockCheckError) {
        console.error(
            JSON.stringify({
                requestId: params.requestId,
                event: "lockout_check_failed",
                email: params.email,
                error: lockCheckError.message,
            })
        );
    }

    if (lockedUser) {
        const isLocked = lockedUser.is_locked === true;
        const lockExpiry = lockedUser.locked_until
            ? new Date(lockedUser.locked_until)
            : null;
        const now = new Date();

        if (isLocked && lockExpiry && lockExpiry > now) {
            await logLoginAttempt({
                email: params.email,
                ipAddress: params.clientIp,
                userAgent: params.userAgent,
                isSuccess: false,
            });

            throw new AppError({
                code: "FORBIDDEN",
                message: "Account is temporarily locked due to too many failed login attempts. Please try again later.",
                status: 403,
            });
        }

        if (isLocked && lockExpiry && lockExpiry <= now) {
            await supabase
                .from("users")
                .update({ is_locked: false, locked_until: null })
                .eq("email", params.email);
        }
    }

    // Step C: Rate limiting
    const windowStart = new Date(Date.now() - LOCKOUT_WINDOW_MINUTES * 60 * 1000).toISOString();

    const { count: failedCount, error: countError } = await supabase
        .from("login_attempts")
        .select("*", { count: "exact", head: true })
        .eq("email_attempted", params.email)
        .eq("ip_address", params.clientIp)
        .eq("is_success", false)
        .gte("attempted_at", windowStart);

    if (countError) {
        console.error(
            JSON.stringify({
                requestId: params.requestId,
                event: "rate_limit_check_failed",
                email: params.email,
                error: countError.message,
            })
        );
    }

    if (failedCount !== null && failedCount >= MAX_FAILED_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000).toISOString();

        await supabase
            .from("users")
            .update({ is_locked: true, locked_until: lockUntil })
            .eq("email", params.email);

        await logLoginAttempt({
            email: params.email,
            ipAddress: params.clientIp,
            userAgent: params.userAgent,
            isSuccess: false,
        });

        console.warn(
            JSON.stringify({
                requestId: params.requestId,
                event: "account_locked",
                email: params.email,
                ip: params.clientIp,
                failedAttempts: failedCount,
                lockedUntil: lockUntil,
            })
        );

        throw new AppError({
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many failed login attempts. Account has been locked for 15 minutes.",
            status: 429,
            retryAfter: LOCKOUT_DURATION_MINUTES * 60,
        });
    }

    // Step D: Auth
    const authClient = getSupabaseAuth();
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
        email: params.email,
        password: params.password,
    });

    const isSuccess = !authError && !!authData?.session;

    await logLoginAttempt({
        email: params.email,
        ipAddress: params.clientIp,
        userAgent: params.userAgent,
        isSuccess,
    });

    if (authError || !authData?.session) {
        console.log(
            JSON.stringify({
                requestId: params.requestId,
                event: "login_failed",
                email: params.email,
                ip: params.clientIp,
                reason: authError?.message ?? "no session returned",
            })
        );

        throw new AppError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
            status: 401,
        });
    }

    console.log(
        JSON.stringify({
            requestId: params.requestId,
            event: "login_success",
            email: params.email,
            ip: params.clientIp,
            userId: authData.user.id,
        })
    );

    return authData;
}



async function logLoginAttempt(
    params : LoginAttemptParams
): Promise<void> {
    try {
        await db.insert(loginAttempts).values({
            emailAttempted: params.email,
            ipAddress: params.ipAddress,
            userAgent: params.userAgent,
            isSuccess: params.isSuccess,
            authProvider: "email",
        });
    } catch (error: any) {
        console.error(
            JSON.stringify({
                event: "login_attempt_log_failed",
                email: params.email,
                error: error.message,
            })
        );
    }
}
