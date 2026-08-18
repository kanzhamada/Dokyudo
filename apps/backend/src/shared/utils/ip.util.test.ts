import { assertEquals } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { extractClientIp, isValidIpAddress } from "./ip.util.ts";

describe("ip utilities", () => {
    it("accepts IPv4 and IPv6 addresses", () => {
        assertEquals(isValidIpAddress("127.0.0.1"), true);
        assertEquals(isValidIpAddress("2001:db8::1"), true);
        assertEquals(isValidIpAddress("not-an-ip"), false);
    });

    it("falls back when the forwarded address is invalid", () => {
        const headers = new Headers({
            "x-forwarded-for": "not-an-ip",
            "x-real-ip": "2001:db8::1",
        });

        assertEquals(extractClientIp(headers), "2001:db8::1");
    });
});
