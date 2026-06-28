import { assertEquals } from "@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import app from "./main.ts";

describe("Main App & Global Endpoints", () => {
    describe("GET /health", () => {
        it("returns 200 with status ok", async () => {
            const randomIp = `127.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
            const req = new Request("http://localhost/health", { 
                method: "GET",
                headers: { "X-Forwarded-For": randomIp }
            });
            const res = await app.fetch(req);

            assertEquals(res.status, 200);
            const json = await res.json();
            assertEquals(json.status, "ok");
        });
    });

    describe("OpenAPI Spec", () => {
        it("GET /doc returns valid OpenAPI spec", async () => {
            const randomIp = `127.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
            const req = new Request("http://localhost/doc", { 
                method: "GET",
                headers: { "X-Forwarded-For": randomIp }
            });
            const res = await app.fetch(req);

            assertEquals(res.status, 200);
            const json = await res.json();
            assertEquals(json.openapi, "3.1.0");
            assertEquals(json.info.title, "Dokyudo API");
            assertEquals(typeof json.paths, "object");
        });

        it("GET /reference returns Scalar API Reference HTML", async () => {
            const randomIp = `127.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
            const req = new Request("http://localhost/reference", { 
                method: "GET",
                headers: { "X-Forwarded-For": randomIp }
            });
            const res = await app.fetch(req);

            assertEquals(res.status, 200);
            const contentType = res.headers.get("content-type") ?? "";
            assertEquals(contentType.includes("text/html"), true);
        });
    });
});
