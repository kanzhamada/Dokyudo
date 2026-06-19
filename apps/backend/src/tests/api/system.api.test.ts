import { assertEquals } from "@std/assert";
import app from "../../main.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────────────────────

Deno.test("GET /health — returns 200 with status ok", async () => {
    const req = new Request("http://localhost/health", { method: "GET" });
    const res = await app.fetch(req);

    assertEquals(res.status, 200);
    const json = await res.json();
    assertEquals(json.status, "ok");
    assertEquals(typeof json.timestamp, "string");
});

// ─────────────────────────────────────────────────────────────────────────────
// OpenAPI Spec
// ─────────────────────────────────────────────────────────────────────────────

Deno.test("GET /doc — returns valid OpenAPI spec", async () => {
    const req = new Request("http://localhost/doc", { method: "GET" });
    const res = await app.fetch(req);

    assertEquals(res.status, 200);
    const json = await res.json();
    assertEquals(json.openapi, "3.1.0");
    assertEquals(json.info.title, "Dokyudo API");
    assertEquals(typeof json.paths, "object");
});

Deno.test("GET /reference — returns Scalar API Reference HTML", async () => {
    const req = new Request("http://localhost/reference", { method: "GET" });
    const res = await app.fetch(req);

    assertEquals(res.status, 200);
    const contentType = res.headers.get("content-type") ?? "";
    assertEquals(contentType.includes("text/html"), true);
});
