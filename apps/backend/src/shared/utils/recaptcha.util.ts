import { RecaptchaVerifyResponse, VerifyRecaptchaParams } from "../types/recaptcha.types.ts";
import { AppError } from "./errors.util.ts";

const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
const SCORE_THRESHOLD = 0.5;

/**
 * Verify a reCAPTCHA v3 token against Google's API.
 *
 * @throws {AppError} VALIDATION_ERROR if token is invalid or score is below threshold
 */
export async function verifyRecaptcha({
    token,
    remoteIp,
    expectedAction,
}: VerifyRecaptchaParams): Promise<RecaptchaVerifyResponse> {
    const secretKey = Deno.env.get("RECAPTCHA_SECRET_KEY")!;

    // Allow local development bypass
    if (Deno.env.get("BYPASS_RECAPTCHA") === "true") {
        return {
            success: true,
            score: 0.9,
            action: expectedAction ?? "bypass",
            challenge_ts: new Date().toISOString(),
            hostname: "localhost"
        };
    }

    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token);
    
    // Google API can return "browser-error" or reject verification if remoteIp is a loopback/internal IP.
    // Only append remoteip if it looks like a valid public/external IP.
    if (remoteIp && !["127.0.0.1", "::1", "0.0.0.0", "localhost"].includes(remoteIp)) {
        formData.append("remoteip", remoteIp);
    }

    let data: RecaptchaVerifyResponse;
    try {
        const response = await fetch(RECAPTCHA_VERIFY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData.toString(),
        });
        data = await response.json();
    } catch {
        throw new AppError({
            code: "INTERNAL_ERROR",
            message: "Failed to verify reCAPTCHA token with Google",
            status: 500,
        });
    }

    // Check if verification itself failed
    if (!data.success) {
        const errorCodes = data["error-codes"]?.join(", ") ?? "unknown";
        throw new AppError({
            code: "VALIDATION_ERROR",
            message: `reCAPTCHA verification failed: ${errorCodes}`,
            status: 400,
        });
    }

    // Verify the action name matches if provided
    if (expectedAction && data.action !== expectedAction) {
        throw new AppError({
            code: "VALIDATION_ERROR",
            message: `reCAPTCHA action mismatch: expected '${expectedAction}', got '${data.action}'`,
            status: 400,
        });
    }

    // Check score threshold (v3-specific)
    if (data.score !== undefined && data.score < SCORE_THRESHOLD) {
        throw new AppError({
            code: "VALIDATION_ERROR",
            message: `reCAPTCHA score too low (${data.score}). Suspected bot activity.`,
            status: 400,
        });
    }

    return data;
}
