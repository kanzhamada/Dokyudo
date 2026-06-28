import { describe, it } from "jsr:@std/testing/bdd";
import { assertEquals } from "jsr:@std/assert";
import { determineAgentType, validatePuzzleToken } from "./crypto_puzzle.util.ts";

describe("Crypto Puzzle Utility", () => {
    describe("determineAgentType", () => {
        it("positive: detects BROWSER from Mozilla", () => {
            assertEquals(determineAgentType("Mozilla/5.0 (Windows NT 10.0)"), "BROWSER");
        });
        it("positive: detects BROWSER from Chrome", () => {
            assertEquals(determineAgentType("Chrome/90.0.4430.93"), "BROWSER");
        });
        it("positive: detects BROWSER from Safari", () => {
            assertEquals(determineAgentType("Safari/604.1"), "BROWSER");
        });
        it("negative: defaults to NON_BROWSER for empty UA", () => {
            assertEquals(determineAgentType(undefined), "NON_BROWSER");
        });
        it("negative: defaults to NON_BROWSER for curl", () => {
            assertEquals(determineAgentType("curl/7.68.0"), "NON_BROWSER");
        });
        it("negative: defaults to NON_BROWSER for Postman", () => {
            assertEquals(determineAgentType("PostmanRuntime/7.28.4"), "NON_BROWSER");
        });
    });

    describe("validatePuzzleToken", () => {
        // Generating a token that matches BROWSER base + optA requirements
        // BROWSER base: K:2, I:2, N:1, S:1, Y:2, J:1, H:1, O:1, 2:1, 1:2, 3:1
        // BROWSER optA: A:1, N:3, T:1, O:1, I:1
        // Total required chars: K:2, I:3, N:4, S:1, Y:2, J:1, H:1, O:2, 2:1, 1:2, 3:1, A:1, T:1 (22 chars)
        // Pad with 'X' to 52 chars
        const validBrowserOptA = "KKIIINNNNSYYJHOO2113ATXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
        
        // Generating a token that matches NON_BROWSER base + optB requirements
        // NON_BROWSER base: A:2, N:3, T:1, O:1, I:1, P:1, R:1, K:1, 3:1, 1:2, 2:1
        // NON_BROWSER optB: J:1, I:1, H:1, Y:1, O:1
        // Total required chars: A:2, N:3, T:1, O:2, I:2, P:1, R:1, K:1, 3:1, 1:2, 2:1, J:1, H:1, Y:1 (21 chars)
        const validNonBrowserOptB = "AANNNTOOIIPRK3112JHYXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

        it("negative: rejects missing token", () => {
            assertEquals(validatePuzzleToken("", "BROWSER"), false);
        });

        it("negative: rejects token of invalid length", () => {
            assertEquals(validatePuzzleToken("K".repeat(51), "BROWSER"), false);
        });

        it("negative: rejects token with invalid characters", () => {
            assertEquals(validatePuzzleToken(validBrowserOptA.replace("A", "-"), "BROWSER"), false);
        });

        it("positive: validates BROWSER token", () => {
            assertEquals(validatePuzzleToken(validBrowserOptA, "BROWSER"), true);
        });

        it("negative: rejects BROWSER token if provided from NON_BROWSER", () => {
            assertEquals(validatePuzzleToken(validBrowserOptA, "NON_BROWSER"), false);
        });

        it("positive: validates NON_BROWSER token", () => {
            assertEquals(validatePuzzleToken(validNonBrowserOptB, "NON_BROWSER"), true);
        });

        it("negative: rejects NON_BROWSER token if provided from BROWSER", () => {
            assertEquals(validatePuzzleToken(validNonBrowserOptB, "BROWSER"), false);
        });
    });
});
