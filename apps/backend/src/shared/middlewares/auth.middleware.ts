import { Context, Next } from "hono";
import { verify, decode } from "hono/jwt";
import { AppError } from "../utils/errors.util.ts";
import { db } from "../../config/drizzle.ts";
import { users } from "../models/db.model.ts";
import { eq } from "drizzle-orm";
import { redis } from "../../config/redis.ts";
import { getSupabaseAnon } from "../../config/supabase.ts";

export async function authMiddleware(c: Context, next: Next) {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new AppError({
            code: "UNAUTHORIZED",
            message: "Missing or invalid Authorization header",
            status: 401,
        });
    }

    const token = authHeader.substring(7);
    const secret = Deno.env.get("SUPABASE_JWT_SECRET");

    if (!secret) {
        throw new AppError({
            code: "INTERNAL_ERROR",
            message: "Server is missing JWT signature secret.",
            status: 500,
        });
    }

    let payload: any;
    let userId: string | undefined;

    try {
        const { header } = decode(token);
        
        if (header.alg === "HS256") {
            // Local fast verification for symmetric secrets
            payload = await verify(token, secret, "HS256");
            userId = payload.sub;
        } else {
            // Network verification for asymmetric keys (ES256/RS256) which Supabase now uses by default
            const supabase = getSupabaseAnon();
            const { data, error } = await supabase.auth.getUser(token);
            
            if (error) throw new Error(error.message);
            if (!data.user) throw new Error("User not found");
            
            payload = {
                sub: data.user.id,
                app_metadata: data.user.app_metadata,
                user_metadata: data.user.user_metadata,
            };
            userId = data.user.id;
        }
    } catch (err: any) {
        const isExpired = err.message?.toLowerCase().includes("expired");
        throw new AppError({
            code: "UNAUTHORIZED",
            message: isExpired ? "JWT has expired" : `Invalid JWT signature: ${err.message}`,
            status: 401,
        });
    }

    if (!userId) {
        throw new AppError({
            code: "UNAUTHORIZED",
            message: "JWT missing 'sub' claim (userId)",
            status: 401,
        });
    }

    // 1. Try to get tenantId from JWT claims (fastest)
    let tenantId =
        payload.app_metadata?.tenant_id ||
        payload.user_metadata?.tenant_id ||
        payload.tenant_id;

    // 2. Fallback to Redis Cache
    const cacheKey = `tenant_map:${userId}`;
    if (!tenantId) {
        try {
            tenantId = await redis.get(cacheKey);
        } catch (err) {
            console.error("Redis get tenant map failed:", err);
        }
    }

    // 3. Fallback to Database Query
    if (!tenantId) {
        try {
            const result = await db
                .select({ tenantId: users.tenantId })
                .from(users)
                .where(eq(users.id, userId))
                .limit(1);

            if (result.length > 0) {
                tenantId = result[0].tenantId;
                // Cache for 1 hour
                try {
                    await redis.setex(cacheKey, 3600, tenantId);
                } catch (err) {
                    console.error("Redis set tenant map failed:", err);
                }
            }
        } catch (err) {
            console.error("Database fetch tenant failed:", err);
            throw new AppError({
                code: "INTERNAL_ERROR",
                message: "Failed to resolve tenant context",
                status: 500,
            });
        }
    }

    if (!tenantId) {
        throw new AppError({
            code: "UNAUTHORIZED",
            message: "User does not belong to any tenant",
            status: 401,
        });
    }

    c.set("userId", userId);
    c.set("tenantId", tenantId);

    await next();
}
