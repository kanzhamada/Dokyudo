import { describe, it } from "jsr:@std/testing/bdd";
import { assertEquals } from "jsr:@std/assert";
import app from "../../main.ts";

/** Helper: make a GET request to the test app */
async function makeGetRequest(path: string): Promise<Response> {
    const randomIp = `127.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
    const req = new Request(`http://localhost${path}`, {
        method: "GET",
        headers: {
            "X-Request-ID": "test-oauth-req-001",
            "X-Forwarded-For": randomIp,
        },
        // Avoid following redirects automatically so we can assert the Location header
        redirect: "manual",
    });
    return await app.fetch(req);
}

describe("OAuth Routes", () => {
    describe("GET /oauth/google", () => {
        it("positive: redirects to Supabase Google OAuth URL", async () => {
            const res = await makeGetRequest("/api/oauth/google");
            assertEquals(res.status, 302);
            
            const location = res.headers.get("Location");
            assertEquals(location !== null, true);
            assertEquals(location?.includes("provider=google"), true);
        });
    });

    describe("GET /oauth/github", () => {
        it("positive: redirects to Supabase GitHub OAuth URL", async () => {
            const res = await makeGetRequest("/api/oauth/github");
            assertEquals(res.status, 302);
            
            const location = res.headers.get("Location");
            assertEquals(location !== null, true);
            assertEquals(location?.includes("provider=github"), true);
        });
    });

    describe("GET /oauth/google/callback", () => {
        it("negative: missing code redirects to frontend with error", async () => {
            const res = await makeGetRequest("/api/oauth/google/callback");
            assertEquals(res.status, 302);
            
            const location = res.headers.get("Location");
            assertEquals(location !== null, true);
            assertEquals(location?.includes("error=Missing%20authorization%20code"), true);
        });

        it("negative: user denied consent (error param) redirects to frontend with error", async () => {
            const res = await makeGetRequest("/api/oauth/google/callback?error=access_denied&error_description=User%20denied%20consent");
            assertEquals(res.status, 302);
            
            const location = res.headers.get("Location");
            assertEquals(location !== null, true);
            assertEquals(location?.includes("error=User%20denied%20consent"), true);
        });

        it("negative: invalid code redirects to frontend with auth failure error", async () => {
            const res = await makeGetRequest("/api/oauth/google/callback?code=invalid_dummy_code_123");
            assertEquals(res.status, 302);
            
            const location = res.headers.get("Location");
            assertEquals(location !== null, true);
            // Assuming Supabase fails to exchange the dummy code and throws UNAUTHORIZED
            assertEquals(location?.includes("error=OAuth%20code%20exchange%20failed"), true);
        });
    });

    describe("GET /oauth/github/callback", () => {
        it("negative: missing code redirects to frontend with error", async () => {
            const res = await makeGetRequest("/api/oauth/github/callback");
            assertEquals(res.status, 302);
            
            const location = res.headers.get("Location");
            assertEquals(location !== null, true);
            assertEquals(location?.includes("error=Missing%20authorization%20code"), true);
        });

        it("negative: user denied consent (error param) redirects to frontend with error", async () => {
            const res = await makeGetRequest("/api/oauth/github/callback?error=access_denied&error_description=User%20denied%20consent");
            assertEquals(res.status, 302);
            
            const location = res.headers.get("Location");
            assertEquals(location !== null, true);
            assertEquals(location?.includes("error=User%20denied%20consent"), true);
        });

        it("negative: invalid code redirects to frontend with auth failure error", async () => {
            const res = await makeGetRequest("/api/oauth/github/callback?code=invalid_dummy_code_123");
            assertEquals(res.status, 302);
            
            const location = res.headers.get("Location");
            assertEquals(location !== null, true);
            // Assuming Supabase fails to exchange the dummy code and throws UNAUTHORIZED
            assertEquals(location?.includes("error=OAuth%20code%20exchange%20failed"), true);
        });
    });
});
