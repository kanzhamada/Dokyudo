import { apiReference } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { AppError } from "./utils/errors.util.ts";
import { requestIdMiddleware } from "./middlewares/request.middleware.ts";
import { validateEnvironment } from "./config/env.ts";
import rootRouter from "./routes/index.ts";
import { createApp } from "./config/hono.ts";

const app = createApp();

// Global middleware: CORS
app.use("/*", cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
    exposeHeaders: ["X-Request-ID"],
}));

// Global middleware: Request ID propagation
app.use("/*", requestIdMiddleware);

// Global Error Handler
app.onError((err, c) => {
    const requestId = c.get("requestId") ?? crypto.randomUUID();

    if (err instanceof AppError) {
        return c.json(err.toJSON(requestId), err.status as 400);
    }

    console.error(
        JSON.stringify({
            requestId,
            error: err.message,
            stack: err.stack,
        })
    );

    return c.json(
        {
            error: {
                code: "INTERNAL_ERROR",
                message: "An unexpected error occurred",
                requestId,
            },
        },
        500
    );
});

// Route Registration
app.get("/health", (c) => {
    return c.json({
        status: "ok",
        timestamp: new Date().toISOString(),
    });
});

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
            url: "http://localhost:8000",
            description: "Local development",
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
    })
);

// Server Startup
const PORT = parseInt(Deno.env.get("PORT") ?? "8000", 10);

if (import.meta.main) {
    validateEnvironment();
    Deno.serve({ port: PORT }, app.fetch);

    console.log(`
🔥 Dokyudo API Gateway is running!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
API:        http://localhost:${PORT}
Health:     http://localhost:${PORT}/health
OpenAPI:    http://localhost:${PORT}/doc
Scalar UI:  http://localhost:${PORT}/reference
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
}

export default app;
