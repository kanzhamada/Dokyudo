import { assertEquals } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { parseUserAgent, parseDeviceInfo } from "./user-agent.util.ts";

describe("parseUserAgent", () => {
    it("extracts Linux desktop details", () => {
        assertEquals(
            parseUserAgent(
                "Mozilla/5.0 (X11; Linux x86_64; rv:153.0) Gecko/20100101 Firefox/153.0",
            ),
            { operatingSystem: "Linux", deviceType: "Desktop" },
        );
    });

    it("extracts mobile details", () => {
        assertEquals(
            parseUserAgent(
                "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36",
            ),
            { operatingSystem: "Android", deviceType: "Mobile" },
        );
    });

    it("returns null details for missing user agents", () => {
        assertEquals(parseUserAgent(null), {
            operatingSystem: null,
            deviceType: null,
        });
    });
});

describe("parseDeviceInfo", () => {
    it("extracts Samsung model from Android user agent", () => {
        assertEquals(
            parseDeviceInfo(
                "Mozilla/5.0 (Linux; Android 13; SM-S911B Build/TP1A.220624.014) AppleWebKit/537.36 Chrome/116.0.0.0 Mobile Safari/537.36",
            ),
            { brand: "Samsung", model: "SM-S911B" },
        );
    });

    it("extracts Pixel model from Android user agent", () => {
        assertEquals(
            parseDeviceInfo(
                "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A.240505.005) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36",
            ),
            { brand: "Google", model: "Pixel 8" },
        );
    });

    it("maps iPhone to Apple without a specific model", () => {
        assertEquals(
            parseDeviceInfo(
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
            ),
            { brand: "Apple", model: "iPhone" },
        );
    });

    it("returns nulls for desktop user agents", () => {
        assertEquals(
            parseDeviceInfo(
                "Mozilla/5.0 (X11; Linux x86_64; rv:153.0) Gecko/20100101 Firefox/153.0",
            ),
            { brand: null, model: null },
        );
    });
});
