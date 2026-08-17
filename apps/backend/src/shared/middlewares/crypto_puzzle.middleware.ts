import { Context, Next } from "hono";
import { AppError } from "../utils/errors.util.ts";
import { redis } from "../../config/redis.ts";
import {
  determineAgentType,
  validatePuzzleToken,
} from "../utils/crypto_puzzle.util.ts";

export async function cryptoPuzzleMiddleware(c: Context, next: Next) {
  const env = Deno.env.get("NODE_ENV");
  if (env === "dev" || env === "test") {
    return await next();
  }

  // Public share reads are exempt from the puzzle: the share page and its
  // OpenGraph image are rendered server-side (Cloudflare Worker -> API) and
  // by social crawlers, neither of which can solve the browser PoW.
  const isPublicShareRead = c.req.method === "GET" &&
    /^\/api\/rag\/shares\/[^/]+$/.test(c.req.path);
  if (isPublicShareRead) {
    return await next();
  }

  // Auth routes and the payments webhook are exempt: they are triggered by
  // top-level browser navigations (OAuth redirect/callback) or by Stripe,
  // none of which can solve the browser PoW puzzle.
  const isAuthRoute = c.req.path.startsWith("/api/auth");
  const isWebhook = c.req.path === "/api/payments/webhook";
  if (isAuthRoute || isWebhook) {
    return await next();
  }

  const token = c.req.header("X-Dokyudo-Puzzle");
  const userAgent = c.req.header("User-Agent");

  if (!token) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Missing X-Dokyudo-Puzzle Proof of Work Header",
      status: 403,
    });
  }

  const agentType = determineAgentType(userAgent);
  const isValid = validatePuzzleToken(token, agentType);

  if (!isValid) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Invalid Crypto Puzzle Token Signature",
      status: 403,
    });
  }

  const redisKey = `puzzle:${token}`;
  try {
    const exists = await redis.get(redisKey);
    if (exists) {
      throw new AppError({
        code: "FORBIDDEN",
        message:
          "Crypto Puzzle Token has already been used (Replay Attack Detected)",
        status: 403,
      });
    }

    await redis.setex(redisKey, 3600, "1");
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    console.error("[CryptoPuzzle] Redis error:", err.message);
  }

  await next();
}
