export type DeviceType = "Desktop" | "Mobile" | "Tablet" | "Bot";

export interface ParsedUserAgent {
    operatingSystem: string | null;
    deviceType: DeviceType | null;
}

export interface ParsedDevice {
    brand: string | null;
    model: string | null;
}

const DEVICE_MODEL_PATTERN = /; ([^;()]+) Build\//;

const BRAND_BY_MODEL_PREFIX: Array<[RegExp, string]> = [
    [/^SM-/i, "Samsung"],
    [/^Pixel/i, "Google"],
    [/^Nexus/i, "Google"],
    [/^(Redmi|POCO|M[0-9]{4}|2112|2106|2210|2302|2311|2401|2404|2410)/i, "Xiaomi"],
    [/^(CPH-|OPPO|A[0-9]{3}|R[0-9]{3}|F[0-9]{3}|Reno)/i, "OPPO"],
    [/^(V[0-9]{4}|Vivo|iQOO)/i, "vivo"],
    [/^(KB[0-9]{4}|IN[0-9]{4}|NE[0-9]{4}|AC[0-9]{3}|ONEPLUS)/i, "OnePlus"],
    [/^(HUAWEI|ELS-|ANA-|MAR-|JNY-|POT-|ELE-|VOG-)/i, "Huawei"],
    [/^(MOT-|motorola|XT[0-9]{3})/i, "Motorola"],
    [/^RMX/i, "Realme"],
    [/^(INFINIX|X[0-9]{3}[A-Z0-9]*)/i, "Infinix"],
    [/^(TECNO|T3-|T5-|TA-)/i, "Tecno"],
    [/^(itel|S[0-9]{3}DL)/i, "itel"],
    [/^(Nokia|TA-[0-9]{4})/i, "Nokia"],
    [/^(Xperia|SO-[0-9]{4}|I[0-9]{4})/i, "Sony"],
    [/^(LG-|LM-|LGM-)/i, "LG"],
    [/^HTC/i, "HTC"],
    [/^(ASUS|Z00)/i, "Asus"],
    [/^(Lenovo|TB-|YT-)/i, "Lenovo"],
    [/^(Honor|ALN-|BKL-|JSN-)/i, "Honor"],
    [/^(Nothing|A0[0-9]{3})/i, "Nothing"],
];

function detectBrand(model: string): string | null {
    for (const [pattern, brand] of BRAND_BY_MODEL_PREFIX) {
        if (pattern.test(model)) return brand;
    }
    return null;
}

/**
 * Extracts the physical device brand and model from a User-Agent.
 * Only mobile user agents reliably carry model tokens; desktop browsers do not
 * expose hardware info, so both fields are null for them.
 */
export function parseDeviceInfo(userAgent?: string | null): ParsedDevice {
    if (!userAgent || userAgent.trim().toLowerCase() === "unknown") {
        return { brand: null, model: null };
    }

    const ua = userAgent.trim();

    if (/iphone/i.test(ua)) {
        return { brand: "Apple", model: "iPhone" };
    }
    if (/ipad/i.test(ua)) {
        return { brand: "Apple", model: "iPad" };
    }
    if (/ipod/i.test(ua)) {
        return { brand: "Apple", model: "iPod" };
    }

    const match = ua.match(DEVICE_MODEL_PATTERN);
    if (!match?.[1]) {
        return { brand: null, model: null };
    }

    const model = match[1].trim().replace(/\s+/g, " ");
    const brand = detectBrand(model);
    return { brand, model };
}

/**
 * Extracts bounded, display-ready client details from a browser User-Agent.
 * The raw User-Agent remains available for exact forensic inspection.
 */
export function parseUserAgent(userAgent?: string | null): ParsedUserAgent {
    if (!userAgent || userAgent.trim().toLowerCase() === "unknown") {
        return { operatingSystem: null, deviceType: null };
    }

    const ua = userAgent.trim();
    const lowerUa = ua.toLowerCase();

    let deviceType: DeviceType;
    if (/bot|crawler|spider|slurp|headless|preview/i.test(ua)) {
        deviceType = "Bot";
    } else if (/ipad|tablet|playbook|silk|android(?!.*mobile)/i.test(ua)) {
        deviceType = "Tablet";
    } else if (
        /mobile|iphone|ipod|android.*mobile|windows phone|blackberry|iemobile|opera mini/i.test(ua)
    ) {
        deviceType = "Mobile";
    } else {
        deviceType = "Desktop";
    }

    let operatingSystem: string | null = null;
    if (/windows phone/i.test(ua)) {
        operatingSystem = "Windows Phone";
    } else if (/windows nt/i.test(ua)) {
        operatingSystem = "Windows";
    } else if (/iphone|ipad|ipod/i.test(ua)) {
        operatingSystem = "iOS";
    } else if (/android/i.test(ua)) {
        operatingSystem = "Android";
    } else if (/cros/i.test(ua)) {
        operatingSystem = "Chrome OS";
    } else if (/ubuntu/i.test(lowerUa)) {
        operatingSystem = "Ubuntu";
    } else if (/macintosh|mac os x/i.test(ua)) {
        operatingSystem = "macOS";
    } else if (/linux/i.test(ua)) {
        operatingSystem = "Linux";
    }

    return { operatingSystem, deviceType };
}
