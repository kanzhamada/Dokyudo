import { describe, it, beforeAll, afterAll } from "jsr:@std/testing/bdd";
import { assertEquals, assertRejects } from "jsr:@std/assert";
import { verifyRecaptcha } from "./recaptcha.util.ts";
import { AppError } from "./errors.util.ts";

describe("reCAPTCHA Utility", () => {
    const originalEnv = Deno.env.get("NODE_ENV");
    const originalFetch = globalThis.fetch;
    let mockFetchResponse: any;

    beforeAll(() => {
        // Ensure we bypass the dev short-circuit to test the actual logic
        Deno.env.set("NODE_ENV", "test");
        Deno.env.set("RECAPTCHA_SECRET_KEY", "dummy-secret");

        // Mock global fetch
        globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
            return new Response(JSON.stringify(mockFetchResponse), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        };
    });

    afterAll(() => {
        if (originalEnv) Deno.env.set("NODE_ENV", originalEnv);
        else Deno.env.delete("NODE_ENV");
        
        globalThis.fetch = originalFetch;
    });

    it("positive: successful verification with good score", async () => {
        mockFetchResponse = {
            success: true,
            score: 0.9,
            action: "login"
        };

        const result = await verifyRecaptcha({ token: "good-token", expectedAction: "login" });
        assertEquals(result.success, true);
        assertEquals(result.score, 0.9);
    });

    it("negative: fails when Google returns success=false", async () => {
        mockFetchResponse = {
            success: false,
            "error-codes": ["invalid-input-response"]
        };

        await assertRejects(
            () => verifyRecaptcha({ token: "bad-token" }),
            AppError,
            "reCAPTCHA verification failed: invalid-input-response"
        );
    });

    it("negative: fails when action mismatch occurs", async () => {
        mockFetchResponse = {
            success: true,
            score: 0.9,
            action: "register"
        };

        await assertRejects(
            () => verifyRecaptcha({ token: "good-token", expectedAction: "login" }),
            AppError,
            "reCAPTCHA action mismatch"
        );
    });

    it("negative: fails when score is below threshold", async () => {
        mockFetchResponse = {
            success: true,
            score: 0.3, // Below 0.5 threshold
            action: "login"
        };

        await assertRejects(
            () => verifyRecaptcha({ token: "good-token", expectedAction: "login" }),
            AppError,
            "reCAPTCHA score too low"
        );
    });
});
