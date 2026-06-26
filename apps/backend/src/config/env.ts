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
] as const;

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

    console.log("✅ All required environment variables are present.");
}
