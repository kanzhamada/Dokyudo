import { describe, it, beforeAll } from "jsr:@std/testing/bdd";
import { assertEquals } from "jsr:@std/assert";
import { Hono } from "hono";
import { requestIdMiddleware } from "./request_id.middleware.ts";

describe("RequestId Middleware", () => {
    let app: Hono<{ Variables: { requestId: string } }>;

    beforeAll(() => {
        app = new Hono<{ Variables: { requestId: string } }>();
        app.use("*", requestIdMiddleware);
        
        app.get("/test", (c) => {
            // Echo back what was injected into context
            return c.json({ contextRequestId: c.get("requestId") });
        });
    });

    it("positive: injects a new UUID if header is missing", async () => {
        const req = new Request("http://localhost/test");
        const res = await app.fetch(req);
        
        const json = await res.json();
        const headerId = res.headers.get("X-Request-ID");
        
        assertEquals(typeof json.contextRequestId, "string");
        assertEquals(json.contextRequestId.length > 10, true);
        assertEquals(headerId, json.contextRequestId); // Ensures header matches context
    });

    it("positive: honors incoming X-Request-ID header", async () => {
        const customId = "frontend-trace-999";
        const req = new Request("http://localhost/test", {
            headers: { "X-Request-ID": customId }
        });
        const res = await app.fetch(req);
        
        const json = await res.json();
        const headerId = res.headers.get("X-Request-ID");
        
        assertEquals(json.contextRequestId, customId);
        assertEquals(headerId, customId);
    });
});
