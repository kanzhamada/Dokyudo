import { describe, it } from "jsr:@std/testing/bdd";
import { assertEquals, assertRejects, assertExists } from "jsr:@std/assert";
import { OAuthService } from "./oauth.service.ts";
import { AppError } from "../../shared/utils/errors.util.ts";

describe("OAuthService Isolated Tests", () => {
    describe("initiateOAuth", () => {
        it("positive: returns a valid Supabase OAuth URL for Google", async () => {
            const url = await OAuthService.initiateOAuth({ provider: "google" });
            assertExists(url);
            assertEquals(url.includes("provider=google"), true);
        });

        it("positive: returns a valid Supabase OAuth URL for GitHub", async () => {
            const url = await OAuthService.initiateOAuth({ provider: "github" });
            assertExists(url);
            assertEquals(url.includes("provider=github"), true);
        });
    });

    describe("handleOAuthCallback", () => {
        it("negative: throws on missing code", async () => {
            await assertRejects(
                () => OAuthService.handleOAuthCallback({ code: "", provider: "google", clientIp: "127.0.0.1" }),
                AppError,
                "Missing authorization code"
            );
        });

        it("negative: throws on invalid code exchange", async () => {
            // "dummy-code" should fail against real Supabase
            await assertRejects(
                () => OAuthService.handleOAuthCallback({ code: "dummy-code", provider: "google", clientIp: "127.0.0.1" }),
                AppError,
                "OAuth code exchange failed"
            );
        });
    });
});
