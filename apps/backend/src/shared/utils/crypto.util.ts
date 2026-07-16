import { AppError } from "./errors.util.ts";

/**
 * Enterprise BYOK Cryptography Utility
 * Uses Web Crypto API (AES-256-GCM) for in-memory encryption and decryption.
 * Designed to prevent LLM API keys from being stored as plaintext.
 */

// Memoized CryptoKey instance to avoid re-importing the key for every operation
let memoizedMasterKey: CryptoKey | null = null;

/**
 * Converts a hex string into a Uint8Array.
 */
function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
    if (hex.length % 2 !== 0) {
        throw new AppError({
            code: "VALIDATION_ERROR",
            message: "Invalid hex string for master key",
            status: 500,
        });
    }
    const buffer = new ArrayBuffer(hex.length / 2);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}

/**
 * Converts a Uint8Array into a hex string.
 */
function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

/**
 * Retrieves and imports the Master Encryption Key (MEK) from the environment.
 */
async function getMasterKey(): Promise<CryptoKey> {
    if (memoizedMasterKey) {
        return memoizedMasterKey;
    }

    const hexKey = Deno.env.get("MASTER_ENCRYPTION_KEY");
    if (!hexKey || hexKey.length !== 64) {
        throw new AppError({
            code: "INTERNAL_ERROR",
            message: "MASTER_ENCRYPTION_KEY is missing or must be exactly 32 bytes (64 hex characters)",
            status: 500,
        });
    }

    const keyBytes = hexToBytes(hexKey);

    memoizedMasterKey = await crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "AES-GCM" },
        false, // Not extractable, secure in memory
        ["encrypt", "decrypt"]
    );

    return memoizedMasterKey;
}

/**
 * Encrypts a plaintext API Key using AES-256-GCM.
 * @returns { encryptedHex: string, ivHex: string }
 */
export async function encryptApiKey(plaintext: string): Promise<{ encryptedApiKey: string; iv: string }> {
    const key = await getMasterKey();
    
    // AES-GCM standard IV size is 12 bytes
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encodedPlaintext = new TextEncoder().encode(plaintext);

    // GCM automatically appends the auth tag to the ciphertext
    const ciphertextBuffer = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv,
        },
        key,
        encodedPlaintext
    );

    return {
        encryptedApiKey: bytesToHex(new Uint8Array(ciphertextBuffer)),
        iv: bytesToHex(iv),
    };
}

/**
 * Decrypts an AES-256-GCM encrypted API Key in-memory.
 */
export async function decryptApiKey(encryptedHex: string, ivHex: string): Promise<string> {
    const key = await getMasterKey();
    
    const iv = hexToBytes(ivHex);
    const ciphertext = hexToBytes(encryptedHex);

    try {
        const decryptedBuffer = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv,
            },
            key,
            ciphertext
        );

        return new TextDecoder().decode(decryptedBuffer);
    } catch (e) {
        throw new AppError({
            code: "UNAUTHORIZED",
            message: "Failed to decrypt API key (Corrupted or Tampered)",
            status: 500,
        });
    }
}

/**
 * Masks an API key for safe UI display (e.g., sk-...1234)
 */
export function maskApiKey(apiKey: string): string {
    if (apiKey.length < 8) return "***";
    
    // Support common prefixes like sk-, ai-, etc.
    const prefixMatch = apiKey.match(/^[a-zA-Z0-9]+-/);
    const prefix = prefixMatch ? prefixMatch[0] : apiKey.substring(0, 3);
    
    const suffix = apiKey.substring(apiKey.length - 4);
    
    return `${prefix}...${suffix}`;
}
