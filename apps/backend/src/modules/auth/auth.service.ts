import { AppError } from "../../shared/utils/errors.util.ts";
import { getSupabaseAdmin, getSupabaseAuth } from "../../config/supabase.ts";
import { db } from "../../config/drizzle.ts";
import { loginAttempts, users } from "../../shared/models/db.model.ts";
import { and, count, eq, gte } from "drizzle-orm";
import { verifyRecaptcha } from "../../shared/utils/recaptcha.util.ts";
import {
  LoginAttemptParams,
  LoginParams,
  LogoutParams,
  RegisterParams,
} from "../../shared/types/auth.types.ts";

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

  const supabase = getSupabaseAdmin();
  const windowStart = new Date(Date.now() - LOCKOUT_WINDOW_MINUTES * 60 * 1000)
    .toISOString();

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
    const distinctUAs = new Set(ipRegData.map((row) => row.userAgent)).size;
    const successCount = ipRegData.filter((row) => row.isSuccess).length;

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
        retryAfter: LOCKOUT_DURATION_MINUTES * 60,
      });
    }
  }

  // Step C: Create user via Supabase Auth Admin API
  const { error: signUpError } = await supabase.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: false, // User must verify via email link
  });

  // Step D: Log registration attempt (success or failure) for rate-limiting calculations
  await logLoginAttempt({
    email: params.email,
    ipAddress: params.clientIp,
    userAgent: params.userAgent,
    isSuccess: !signUpError,
    authProvider: "register",
  });

  if (signUpError) {
    if (
      signUpError.message?.toLowerCase().includes("already registered") ||
      signUpError.message?.toLowerCase().includes("already been registered") ||
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

  if (params.logContext) {
    params.logContext.authEvent = "user_registered";
    params.logContext.authEmail = params.email;
  }
}

export async function loginUser(params: LoginParams) {
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
      .select({ isLocked: users.isLocked, lockedUntil: users.lockedUntil })
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
        .set({ isLocked: false, lockedUntil: null })
        .where(eq(users.email, params.email));
    }
  }

  // Step C: Advanced Anti-Bruteforce & Correlation Logic
  const windowStart = new Date(Date.now() - LOCKOUT_WINDOW_MINUTES * 60 * 1000)
    .toISOString();

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
    const distinctUAs = new Set(ipFailData.map((row) => row.userAgent)).size;
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
        retryAfter: LOCKOUT_DURATION_MINUTES * 60,
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

  if (emailFailCount >= MAX_FAILED_ATTEMPTS) {
    const lockUntilDate = new Date(
      Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000,
    );
    const lockUntil = lockUntilDate.toISOString();

    await db
      .update(users)
      .set({ isLocked: true, lockedUntil: lockUntilDate })
      .where(eq(users.email, params.email));

    throw new AppError({
      code: "RATE_LIMIT_EXCEEDED",
      message:
        "Too many failed login attempts, account has been locked for 15 minutes",
      status: 429,
      retryAfter: LOCKOUT_DURATION_MINUTES * 60,
    });
  }

  // Step D: Auth
  const authClient = getSupabaseAuth();
  const { data: authData, error: authError } = await authClient.auth
    .signInWithPassword({
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
    if (params.logContext) {
      params.logContext.authEvent = "login_failed";
      params.logContext.authEmail = params.email;
      params.logContext.authError = authError?.message ?? "no session returned";
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

  return authData;
}

async function logLoginAttempt(
  params: LoginAttemptParams,
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
    // For background logging tasks, we just silently fail or log locally
    // since we may not have the request context here.
    console.error(
      `Failed to log login attempt for ${params.email}: ${error.message}`,
    );
  }
}

export async function logoutUser(params: LogoutParams) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.auth.admin.signOut(
    params.accessToken,
    "global",
  );

  if (error) {
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
