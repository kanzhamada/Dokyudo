import { apiReference } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { AppError } from "./shared/utils/errors.util.ts";
import { requestIdMiddleware } from "./shared/middlewares/request_id.middleware.ts";
import { loggerMiddleware } from "./shared/middlewares/logger.middleware.ts";
import { rateLimiterMiddleware } from "./shared/middlewares/rate_limiter.middleware.ts";
import { getEnv, validateEnvironment } from "./config/env.ts";
import rootRouter from "./api/router.ts";
import { cryptoPuzzleMiddleware } from "./shared/middlewares/crypto_puzzle.middleware.ts";
import { createApp } from "./config/hono.ts";
import { RagService } from "./modules/rag/rag.service.ts";

const app = createApp();

// Global middleware: CORS
const frontendOrigin = getEnv("FRONTEND_URL");
app.use(
  "/*",
  cors({
    origin: frontendOrigin,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-ID",
      "X-Dokyudo-Puzzle",
    ],
    exposeHeaders: ["X-Request-ID"],
  }),
);

// Global middleware: CSRF defense-in-depth for state-changing requests.
// SameSite=Lax cookies already block most cross-site CSRF; this rejects
// requests that carry a foreign Origin (except OAuth/webhook callbacks).
app.use("/api/*", async (c, next) => {
  const method = c.req.method;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return await next();
  }

  const isCallback = c.req.path.startsWith("/api/auth/oauth") ||
    c.req.path === "/api/payments/webhook";
  if (isCallback) {
    return await next();
  }

  const origin = c.req.header("Origin");
  if (origin && origin !== frontendOrigin) {
    return c.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "Cross-origin request rejected",
          requestId: c.get("requestId") ?? crypto.randomUUID(),
        },
      },
      403,
    );
  }

  await next();
});

// Global middleware: Request ID propagation & Logging
app.use("/*", requestIdMiddleware);
app.use("/*", loggerMiddleware);
app.use("/*", rateLimiterMiddleware);

// Global Error Handler
app.onError((err, c) => {
  const requestId = c.get("requestId") ?? crypto.randomUUID();

  if (err instanceof AppError) {
    return c.json(err.toJSON(requestId), err.status as 400);
  }

  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        requestId,
      },
    },
    500,
  );
});

// Route Registration
app.get("/health", (c) => {
  return c.json({
    status: "ok",
  });
});

// Main API
app.use("/api/*", cryptoPuzzleMiddleware);
app.route("/api", rootRouter);

const PORT = parseInt(getEnv("PORT") || "8000", 10);
const API_URL = getEnv("API_URL") || `http://localhost:${PORT}`;

// OpenAPI Documentation
app.doc("/doc", {
  openapi: "3.1.0",
  info: {
    title: "Dokyudo API",
    version: "0.1.0",
    description: "SaaS Semantic Document Search & Q&A Platform — API Gateway",
  },
  servers: [
    {
      url: API_URL,
      description: "API Environment",
    },
  ],
});

// Scalar API Reference UI
app.get(
  "/reference",
  apiReference({
    spec: {
      url: "/doc",
    },
    theme: "kepler",
    layout: "modern",
    defaultHttpClient: {
      targetKey: "shell",
      clientKey: "curl",
    },
  }),
);

// Server Startup
if (import.meta.main) {
  validateEnvironment();
  Deno.serve({ port: PORT }, app.fetch);

  // Background sweep for chat turns awaiting document ingestion
  Deno.cron("sweep-awaiting-turns", "* * * * *", async () => {
    await RagService.sweepAwaitingTurns();
  });

  console.log(`
API:        ${API_URL}/api
Health:     ${API_URL}/health
OpenAPI:    ${API_URL}/doc
Scalar UI:  ${API_URL}/reference
  `);
}

export default app;
