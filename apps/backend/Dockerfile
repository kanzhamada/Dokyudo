FROM denoland/deno:alpine

WORKDIR /app

# Copy dependency definitions and lockfile
COPY deno.json deno.lock ./

# Copy source code and drizzle schemas
COPY src ./src
COPY drizzle ./drizzle

# Pre-cache dependencies during image build
RUN deno cache --allow-import src/main.ts

EXPOSE 8000

CMD ["run", "--unstable-cron", "--allow-net", "--allow-env", "--allow-read", "--allow-sys", "src/main.ts"]
