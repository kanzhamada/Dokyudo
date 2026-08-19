import { getEnv } from "../../config/env.ts";

/**
 * Normalizes and hashes an email address using HMAC-SHA256 with a server secret pepper.
 * This generates a deterministic, pseudonymized hash that:
 * 1. Enables cross-account/lifecycle verification (e.g. rate-limiting trial tiers).
 * 2. Complies with privacy/GDPR erasure mandates since the raw PII is not retained.
 *
 * @param email - The raw email address to hash.
 * @returns 64-character lowercase hex string representing the HMAC-SHA256.
 */
export async function hashUserEmail(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const pepper = getEnv("EMAIL_HASH_PEPPER") || "dokyudo-email-hash-default-pepper-secret";

  const encoder = new TextEncoder();
  const keyData = encoder.encode(pepper);
  const messageData = encoder.encode(normalized);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
