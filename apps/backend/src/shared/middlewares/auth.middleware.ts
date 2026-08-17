import { Context, Next } from "hono";
import { decode, verify } from "hono/jwt";
import { getCookie } from "hono/cookie";
import { AppError } from "../utils/errors.util.ts";
import { db } from "../../config/drizzle.ts";
import { users } from "../models/db.model.ts";
import { eq } from "drizzle-orm";
import { redis } from "../../config/redis.ts";
import { getSupabaseAnon } from "../../config/supabase.ts";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  setSessionCookies,
} from "../../config/cookie.ts";

export interface ResolvedSession {
  accessToken: string;
  userId: string;
  tenantId: string;
  email: string;
}

/**
 * Resolves the current session from the httpOnly cookies (with Bearer header
 * fallback for backward compatibility). Performs a silent refresh when the
 * access token has expired but a valid refresh token is present.
 *
 * Returns null when no usable session could be established — callers decide
 * whether that means 401 (protected routes) or "unauthenticated" (session
 * check endpoint).
 */
export async function resolveSession(
  c: Context,
): Promise<ResolvedSession | null> {
  let token = getCookie(c, ACCESS_TOKEN_COOKIE);
  const refreshToken = getCookie(c, REFRESH_TOKEN_COOKIE);

  // Backward compatibility: fall back to the Authorization header.
  const authHeader = c.req.header("Authorization");
  if (!token && authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  }

  if (!token) return null;

  const secret = Deno.env.get("SUPABASE_JWT_SECRET");
  if (!secret) return null;

  let payload: any;

  try {
    payload = await verifyAccessToken(token, secret);
  } catch (err: any) {
    const isExpired = err.message?.toLowerCase().includes("expired");
    if (!isExpired || !refreshToken) return null;

    // Silent refresh — the access token expired but the refresh token is
    // still valid. Mint a fresh session and re-issue the cookies so the
    // user is not logged out mid-use.
    try {
      const supabase = getSupabaseAnon();
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error || !data.session) return null;

      setSessionCookies(
        c,
        data.session.access_token,
        data.session.refresh_token,
      );

      token = data.session.access_token;
      payload = {
        sub: data.session.user.id,
        email: data.session.user.email,
        user_metadata: data.session.user.user_metadata,
      };
    } catch {
      return null;
    }
  }

  const userId = payload?.sub;
  if (!userId) return null;

  // Resolve the tenant mapping (JWT claims → Redis cache → database).
  let tenantId = payload.app_metadata?.tenant_id ||
    payload.user_metadata?.tenant_id ||
    payload.tenant_id;

  const cacheKey = `tenant_map:${userId}`;
  if (!tenantId) {
    try {
      tenantId = await redis.get(cacheKey);
    } catch {
      // Redis is best-effort here — fall through to the database.
    }
  }

  if (!tenantId) {
    try {
      const result = await db
        .select({ tenantId: users.tenantId })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (result.length > 0) {
        tenantId = result[0].tenantId;
        try {
          await redis.setex(cacheKey, 3600, tenantId);
        } catch {
          // Cache write failure is non-fatal.
        }
      }
    } catch {
      return null;
    }
  }

  if (!tenantId) return null;

  const email = payload.email ??
    payload.user_metadata?.email ??
    payload.app_metadata?.email ??
    "";

  return { accessToken: token, userId, tenantId, email };
}

async function verifyAccessToken(token: string, secret: string): Promise<any> {
  const { header } = decode(token);

  if (header.alg === "HS256") {
    // Local fast verification for symmetric secrets.
    return await verify(token, secret, "HS256");
  }

  // Network verification for asymmetric keys (ES256/RS256) which Supabase
  // now uses by default.
  const supabase = getSupabaseAnon();
  const { data, error } = await supabase.auth.getUser(token);
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("User not found");

  return {
    sub: data.user.id,
    email: data.user.email,
    user_metadata: data.user.user_metadata,
    app_metadata: data.user.app_metadata,
  };
}

export async function authMiddleware(c: Context, next: Next) {
  const session = await resolveSession(c);

  if (!session) {
    throw new AppError({
      code: "UNAUTHORIZED",
      message: "Invalid or expired session",
      status: 401,
    });
  }

  c.set("userId", session.userId);
  c.set("tenantId", session.tenantId);
  c.set("accessToken", session.accessToken);

  await next();
}
