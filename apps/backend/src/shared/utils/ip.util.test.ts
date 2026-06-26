import { assertEquals } from "@std/assert";
import { extractClientIp } from "./ip.util.ts";

Deno.test("extractClientIp — X-Forwarded-For takes priority", () => {
    const headers = new Headers({
        "X-Forwarded-For": "203.0.113.50, 70.41.3.18, 150.172.238.178",
        "X-Real-IP": "10.0.0.1",
    });
    assertEquals(extractClientIp(headers), "203.0.113.50");
});

Deno.test("extractClientIp — falls back to X-Real-IP", () => {
    const headers = new Headers({
        "X-Real-IP": "10.0.0.1",
    });
    assertEquals(extractClientIp(headers), "10.0.0.1");
});

Deno.test("extractClientIp — falls back to CF-Connecting-IP", () => {
    const headers = new Headers({
        "CF-Connecting-IP": "172.16.0.5",
    });
    assertEquals(extractClientIp(headers), "172.16.0.5");
});

Deno.test("extractClientIp — falls back to 0.0.0.0 with no headers", () => {
    const headers = new Headers();
    assertEquals(extractClientIp(headers), "0.0.0.0");
});

Deno.test("extractClientIp — single IP in X-Forwarded-For", () => {
    const headers = new Headers({
        "X-Forwarded-For": "192.168.1.1",
    });
    assertEquals(extractClientIp(headers), "192.168.1.1");
});
