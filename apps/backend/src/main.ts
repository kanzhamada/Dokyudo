import { apiReference } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { AppError } from "./shared/utils/errors.util.ts";
import { requestIdMiddleware } from "./shared/middlewares/request_id.middleware.ts";
import { loggerMiddleware } from "./shared/middlewares/logger.middleware.ts";
import { rateLimiterMiddleware } from "./shared/middlewares/rate_limiter.middleware.ts";
import { validateEnvironment } from "./config/env.ts";
import rootRouter from "./api/router.ts";
import { createApp } from "./config/hono.ts";

const app = createApp();

// Global middleware: CORS
app.use(
  "/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
    exposeHeaders: ["X-Request-ID"],
  }),
);

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
    timestamp: new Date().toISOString(),
  });
});

// Main API
app.route("/api", rootRouter);

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
      url: Deno.env.get("API_URL") ??
        `http://${Deno.env.get("HOSTNAME") ?? "localhost"}:${
          Deno.env.get("PORT") ?? "8000"
        }`,
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
const PORT = parseInt(Deno.env.get("PORT") ?? "8000", 10);
const HOSTNAME = Deno.env.get("HOSTNAME") ?? "localhost";
const API_URL = Deno.env.get("API_URL") ?? `http://${HOSTNAME}:${PORT}`;

if (import.meta.main) {
  validateEnvironment();
  Deno.serve({ port: PORT }, app.fetch);

  console.log(`
API:        ${API_URL}/api
Health:     ${API_URL}/health
OpenAPI:    ${API_URL}/doc
Scalar UI:  ${API_URL}/reference
  `);
}

export default app;
