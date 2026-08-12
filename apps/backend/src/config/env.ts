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
    // Free provider keys — optional so server still boots without them
    GROQ_API_KEY: "",
    SAMBANOVA_API_KEY: "",
    COHERE_API_KEY: "",
};
/**
 * Validates that all required environment variables are present and non-empty.
 * Called at server startup (not during test imports).
 */
export function validateEnvironment(): void {
    const missingVars: string[] = [];
    for (const varName of REQUIRED_ENV_VARS) {
        const value = Deno.env.get(varName);
        if (!value || value.trim() === "") {
            missingVars.push(varName);
        }
    }

    if (missingVars.length > 0) {
        console.error(
            `\n🛑 ERROR: Missing required ENV variables. Halting execution.\n` +
                `   Missing: ${missingVars.join(", ")}\n` +
                `   Ensure these are set in your .env file or environment.\n`,
        );
        Deno.exit(1);
    }

    // Warn about optional vars using defaults
    for (const [varName, defaultValue] of Object.entries(
        OPTIONAL_ENV_VARS_WITH_DEFAULTS,
    )) {
        if (!Deno.env.get(varName)) {
            console.warn(
                `⚠️  ${varName} not set, using default: ${defaultValue}`,
            );
        }
    }

    console.log("✅ All required environment variables are present.");
}

/**
 * Gets an environment variable with optional fallback.
 * For optional vars, uses the configured default from OPTIONAL_ENV_VARS_WITH_DEFAULTS.
 */
export function getEnv(key: string): string {
    return Deno.env.get(key) || OPTIONAL_ENV_VARS_WITH_DEFAULTS[key] || "";
}
