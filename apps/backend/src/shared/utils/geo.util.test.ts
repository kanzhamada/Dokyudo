import { assertEquals } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { extractCountryCode, getClientLocation } from "./geo.util.ts";

describe("geo utilities", () => {
    it("extracts a country code from the Cloudflare header", () => {
        assertEquals(
            extractCountryCode(new Headers({ "cf-ipcountry": "id" })),
            "ID",
        );
    });

    it("returns null when the country header is missing or invalid", () => {
        assertEquals(extractCountryCode(new Headers()), null);
        assertEquals(
            extractCountryCode(new Headers({ "cf-ipcountry": "not-a-code" })),
            null,
        );
    });

    it("resolves the country code to a human-readable name", () => {
        assertEquals(
            getClientLocation(new Headers({ "cf-ipcountry": "ID" })),
            "Indonesia",
        );
    });

    it("falls back to the raw code for unknown countries", () => {
        assertEquals(
            getClientLocation(new Headers({ "cf-ipcountry": "XX" })),
            "XX",
        );
    });
});