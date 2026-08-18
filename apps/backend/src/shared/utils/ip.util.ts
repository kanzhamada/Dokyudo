/**
 * Extracts the client IP address from the request, handling reverse proxy headers.
 *
 * Priority order:
 *   1. X-Forwarded-For (first valid IP in chain)
 *   2. X-Real-IP
 *   3. CF-Connecting-IP (Cloudflare)
 *   4. Fallback: "0.0.0.0"
 */
function isValidIpv4(value: string): boolean {
    const parts = value.split(".");
    return parts.length === 4 && parts.every((part) => {
        if (!/^\d{1,3}$/.test(part)) return false;
        const number = Number(part);
        return number >= 0 && number <= 255;
    });
}

function isValidIpv6(value: string): boolean {
    if (!value.includes(":")) return false;
    if (value.includes("%") || value.split("::").length > 2) return false;

    const hasCompression = value.includes("::");
    const [left, right = ""] = hasCompression ? value.split("::") : [value, ""];
    const parts = [...(left ? left.split(":") : []), ...(right ? right.split(":") : [])];
    let groupCount = 0;

    for (const [index, part] of parts.entries()) {
        if (part.includes(".")) {
            if (index !== parts.length - 1 || !isValidIpv4(part)) return false;
            groupCount += 2;
        } else {
            if (!/^[0-9a-f]{1,4}$/i.test(part)) return false;
            groupCount += 1;
        }
    }

    return hasCompression ? groupCount < 8 : groupCount === 8;
}

export function isValidIpAddress(value: string): boolean {
    const trimmed = value.trim();
    const hasOpeningBracket = trimmed.startsWith("[");
    const hasClosingBracket = trimmed.endsWith("]");
    if (hasOpeningBracket !== hasClosingBracket) return false;

    const normalized = hasOpeningBracket
        ? trimmed.slice(1, -1)
        : trimmed;
    return isValidIpv4(normalized) || isValidIpv6(normalized);
}

function getValidIp(value: string | null): string | null {
    if (!value) return null;
    const candidate = value.trim();
    return isValidIpAddress(candidate) ? candidate.replace(/^\[|\]$/g, "") : null;
}

export function extractClientIp(headers: Headers): string {
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded) {
        // X-Forwarded-For may contain multiple IPs: client, proxy1, proxy2
        const firstIp = getValidIp(forwarded.split(",")[0] ?? null);
        if (firstIp) return firstIp;
    }

    const realIp = getValidIp(headers.get("x-real-ip"));
    if (realIp) return realIp;

    const cfIp = getValidIp(headers.get("cf-connecting-ip"));
    if (cfIp) return cfIp;

    return "0.0.0.0";
}
