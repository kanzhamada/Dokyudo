const REQUIRED_ENV_VARS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_ANON_KEY",
  "SUPABASE_JWT_SECRET",
  "DATABASE_URL",
  "RECAPTCHA_SECRET_KEY",
  "GOOGLE_API_KEY",
  "UPSTASH_VECTOR_REST_URL",
  "UPSTASH_VECTOR_REST_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "RESEND_API_KEY",
  "S3_ENDPOINT",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
  "S3_BUCKET_NAME",
  "STB_WORKER_URL",
  "STB_WORKER_SECRET",
  "STRIPE_PRICE_PRO",
  "STRIPE_PRICE_SIMULATE",
  "STRIPE_PRICE_OIL_INVESTOR",
] as const;

/** Optional env vars with sensible defaults */
const OPTIONAL_ENV_VARS_WITH_DEFAULTS: Record<string, string> = {
  FRONTEND_URL: "http://localhost:5173",
  // Backend's own public URL, used for OAuth callback redirects (PKCE).
  API_URL: "http://localhost:8000",
  // Shared registrable domain for session cookies (e.g. dokyudo.my.id).
  // Empty in development so cookies stay host-only for localhost.
  COOKIE_DOMAIN: "",
  // Free provider keys — optional so server still boots without them
  GROQ_API_KEY: "",
  SAMBANOVA_API_KEY: "",
  COHERE_API_KEY: "",
};

/**
 * Strips surrounding quotes (single or double) from environment variable values.
 * Useful when values are passed via Docker --env-file or shell quotes.
 */
function cleanEnvValue(raw: string): string {
  let trimmed = raw.trim();
  while (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/**
 * Gets an environment variable with optional fallback.
 * Automatically cleans leading/trailing whitespace and surrounding quotation marks.
 */
export function getEnv(key: string): string {
  let val = "";
  if (typeof Deno !== "undefined" && typeof Deno.env?.get === "function") {
    val = Deno.env.get(key) || "";
  } else if (typeof process !== "undefined" && process.env?.[key]) {
    val = process.env[key] || "";
  }

  if (!val) {
    val = OPTIONAL_ENV_VARS_WITH_DEFAULTS[key] || "";
  }

  return cleanEnvValue(val);
}

/**
 * Validates that all required environment variables are present and non-empty.
 * Called at server startup (not during test imports).
 */
export function validateEnvironment(): void {
  const missingVars: string[] = [];
  for (const varName of REQUIRED_ENV_VARS) {
    const value = getEnv(varName);
    if (!value || value.trim() === "") {
      missingVars.push(varName);
    }
  }

  if (missingVars.length > 0) {
    console.error(
      `\nMissing required ENV variables. Halting execution.\n` +
        `   Missing: ${missingVars.join(", ")}\n` +
        `   Ensure these are set in your .env file or environment.\n`,
    );
    if (typeof Deno !== "undefined" && typeof Deno.exit === "function") {
      Deno.exit(1);
    } else {
      throw new Error(
        `Missing required ENV variables: ${missingVars.join(", ")}`,
      );
    }
  }

  // Warn about optional vars using defaults
  for (
    const [varName, defaultValue] of Object.entries(
      OPTIONAL_ENV_VARS_WITH_DEFAULTS,
    )
  ) {
    if (!getEnv(varName)) {
      console.warn(
        `${varName} not set, using default: ${defaultValue}`,
      );
    }
  }

  console.log("All required environment variables are present.");
}
