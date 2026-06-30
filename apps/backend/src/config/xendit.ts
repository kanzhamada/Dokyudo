import { encodeBase64 } from "jsr:@std/encoding/base64";
import { getEnv } from "./env.ts";
import { AppError } from "../shared/utils/errors.util.ts";

export class XenditClient {
    private static readonly BASE_URL = "https://api.xendit.co";

    /**
     * Build HTTP headers with Basic Auth using XENDIT_SECRET_KEY.
     * Note: Xendit requires the secret key to be followed by a colon ":" before Base64 encoding.
     */
    private static getHeaders() {
        const secretKey = getEnv("XENDIT_SECRET_KEY");
        if (!secretKey) throw new Error("XENDIT_SECRET_KEY is missing in environment");
        
        const encodedKey = encodeBase64(`${secretKey}:`);
        
        return {
            "Content-Type": "application/json",
            "Authorization": `Basic ${encodedKey}`,
            // According to Xendit docs, v3 Payment Requests require this specific header
            "api-version": "2024-11-11" 
        };
    }

    /**
     * Create a new Payment Request in Xendit API v3
     */
    static async createPaymentRequest(payload: Record<string, any>) {
        const response = await fetch(`${this.BASE_URL}/v3/payment_requests`, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new AppError({
                code: "PROVIDER_UNAVAILABLE",
                status: response.status,
                message: `Xendit API Error [${response.status}]: ${JSON.stringify(errorData)}`
            });
        }

        return await response.json();
    }

    /**
     * Validates the 'x-callback-token' header from incoming Xendit Webhooks.
     * Rejects invalid or missing tokens to prevent malicious payload injection.
     */
    static verifyWebhookToken(requestToken: string | undefined | null): boolean {
        const expectedToken = getEnv("XENDIT_WEBHOOK_SECRET");
        if (!expectedToken) {
            console.error("CRITICAL: XENDIT_WEBHOOK_SECRET is not configured on the server!");
            return false;
        }
        
        if (!requestToken) return false;

        // Simple string comparison for the verification token.
        return requestToken === expectedToken;
    }
}
