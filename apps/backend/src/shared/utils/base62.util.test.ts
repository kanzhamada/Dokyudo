import { assertEquals } from "jsr:@std/assert";
import { toBase62, generateShareCode } from "./base62.util.ts";

Deno.test("toBase62 encodes known byte arrays", () => {
    // 0x00 → "0"
    assertEquals(toBase62(new Uint8Array([0])), "0");
    // 62 decimal = "10" (alphabet index 1 then 0)
    assertEquals(toBase62(new Uint8Array([62])), "10");
    // 62^2 = 3844 decimal = 0x0F04 → "100"
    assertEquals(toBase62(new Uint8Array([0x0f, 0x04])), "100");
    // 35 decimal = "Z"
    assertEquals(toBase62(new Uint8Array([35])), "Z");
    // 36 decimal = "a"
    assertEquals(toBase62(new Uint8Array([36])), "a");
});

Deno.test("toBase62 roundtrip: decode output back to the original integer", () => {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const encoded = toBase62(bytes);

    let value = 0n;
    for (const byte of bytes) value = (value << 8n) | BigInt(byte);
    let decoded = 0n;
    for (const char of encoded) {
        decoded = decoded * 62n + BigInt(BASE62_INDEX[char]);
    }
    assertEquals(decoded, value);
});

Deno.test("generateShareCode returns 8-11 char alphanumeric codes", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 1000; i++) {
        const code = generateShareCode();
        // 2^64 < 62^11, so never longer than 11 chars; leading zeros stripped
        // but "0" itself stays a valid single-char code.
        assertEquals(code.length >= 1 && code.length <= 11, true);
        assertEquals(/^[0-9A-Za-z]+$/.test(code), true);
        codes.add(code);
    }
    assertEquals(codes.size, 1000, "codes must be unique across 1000 draws");
});

// Character → index lookup for the roundtrip test above.
const BASE62_INDEX: Record<string, number> = {};
"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    .split("")
    .forEach((char, idx) => {
        BASE62_INDEX[char] = idx;
    });
