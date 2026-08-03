import { assertEquals } from "jsr:@std/assert";
import { describe, it, beforeAll } from "jsr:@std/testing/bdd";

describe("Me Routes Tests", () => {
    let app: any;

    beforeAll(async () => {
        // Set dummy env variables before importing main app
        Deno.env.set("SUPABASE_JWT_SECRET", "dummy-jwt-secret-key-1234567890");
        Deno.env.set("UPSTASH_VECTOR_REST_URL", "https://dummy-vector.upstash.io");
        Deno.env.set("UPSTASH_VECTOR_REST_TOKEN", "dummy-vector-token");
        Deno.env.set("UPSTASH_REDIS_REST_URL", "https://dummy-redis.upstash.io");
        Deno.env.set("UPSTASH_REDIS_REST_TOKEN", "dummy-redis-token");
        Deno.env.set("RESEND_API_KEY", "re_dummy_key");
        Deno.env.set("NODE_ENV", "dev");

        const mainModule = await import("../../main.ts");
        app = mainModule.default;
    });

    describe("GET /api/me", () => {
        it("negative: missing authorization header returns 401", async () => {
            const req = new Request("http://localhost/api/me", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "X-Request-ID": "test-req-me-001",
                },
            });
            const res = await app.fetch(req);
            assertEquals(res.status, 401);
            const json = await res.json();
            assertEquals(json.error.code, "UNAUTHORIZED");
        });

        it("negative: invalid bearer token returns 401", async () => {
            const req = new Request("http://localhost/api/me", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer invalid-jwt-token-xyz",
                    "X-Request-ID": "test-req-me-002",
                },
            });
            const res = await app.fetch(req);
            assertEquals(res.status, 401);
            const json = await res.json();
            assertEquals(json.error.code, "UNAUTHORIZED");
        });
    });

    describe("GET /api/me/usage", () => {
        it("negative: missing authorization header returns 401", async () => {
            const req = new Request("http://localhost/api/me/usage", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "X-Request-ID": "test-req-usage-001",
                },
            });
            const res = await app.fetch(req);
            assertEquals(res.status, 401);
            const json = await res.json();
            assertEquals(json.error.code, "UNAUTHORIZED");
        });

        it("negative: invalid bearer token returns 401", async () => {
            const req = new Request("http://localhost/api/me/usage", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer invalid-jwt-token-xyz",
                    "X-Request-ID": "test-req-usage-002",
                },
            });
            const res = await app.fetch(req);
            assertEquals(res.status, 401);
            const json = await res.json();
            assertEquals(json.error.code, "UNAUTHORIZED");
        });
    });
});
