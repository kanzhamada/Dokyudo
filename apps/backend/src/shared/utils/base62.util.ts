const BASE62_ALPHABET =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Encodes a big-endian byte array into a base62 string. Used for short share
 * codes. Random bytes (not a sequence) so public links cannot be enumerated.
 */
export function toBase62(bytes: Uint8Array): string {
    let value = 0n;
    for (const byte of bytes) {
        value = (value << 8n) | BigInt(byte);
    }
    if (value === 0n) return "0";
    let out = "";
    while (value > 0n) {
        out = BASE62_ALPHABET[Number(value % 62n)] + out;
        value /= 62n;
    }
    return out;
}

/**
 * Generates a random base62 share code from 8 cryptographically-random bytes
 * (up to 11 chars, 2^64 entropy). Collisions are possible in theory; callers
 * must retry on unique-violation (or surface a 409 for custom codes).
 */
export function generateShareCode(): string {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return toBase62(bytes);
}
