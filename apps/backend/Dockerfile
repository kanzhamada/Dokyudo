# --- STAGE 1: Builder (Pre-cache dependencies) ---
FROM denoland/deno:alpine AS builder

ENV DENO_DIR=/deno-dir
WORKDIR /app

# Copy dependency manifests first for build cache optimization
COPY deno.json deno.lock ./

# Copy source code and database migrations/schemas
COPY src ./src
COPY drizzle ./drizzle

# Pre-cache all dependencies so DENO_DIR is fully populated during build
RUN deno cache --allow-import src/main.ts

# --- STAGE 2: Production Image ---
FROM denoland/deno:alpine

ENV DENO_DIR=/deno-dir
WORKDIR /app

# Copy populated Deno cache and application code from builder stage
COPY --from=builder /deno-dir /deno-dir
COPY --from=builder /app /app

EXPOSE 8000

# Container Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD deno eval "try { const res = await fetch('http://localhost:8000/health'); if (!res.ok) Deno.exit(1); } catch { Deno.exit(1); }"

CMD ["run", "--unstable-cron", "--allow-net", "--allow-env", "--allow-read", "--allow-sys", "src/main.ts"]
