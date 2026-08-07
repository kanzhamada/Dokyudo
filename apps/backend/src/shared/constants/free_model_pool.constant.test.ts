import { describe, it } from "jsr:@std/testing/bdd";
import { assertEquals } from "jsr:@std/assert";
import { selectTier } from "./free_model_pool.constant.ts";

// contextTokens = 4200 → discounted contribution = 4200 * 0.1 = 420
const CTX = 4200;

describe("selectTier", () => {
    // Primary signal: conversation depth
    it("routes fresh conversations (depth 0) to LIGHT", () => {
        assertEquals(
            selectTier({ historyDepth: 0, questionTokens: 4, historyTokens: 0, contextTokens: CTX, totalTokens: 4539 }),
            "LIGHT",
        );
    });

    it("routes depth-1 turns to LIGHT when the complexity score is small", () => {
        // Tiny history (e.g. previous answer was trivial) + short question:
        // score = 4 + 30 + 420 = 454 ≤ DEPTH1_LIGHT_MAX (500)
        assertEquals(
            selectTier({ historyDepth: 1, questionTokens: 4, historyTokens: 30, contextTokens: CTX, totalTokens: 4700 }),
            "LIGHT",
        );
    });

    it("routes depth-1 turns to MEDIUM when the score exceeds the LIGHT ceiling", () => {
        // Normal previous turn: score = 20 + 430 + 420 = 870 > 500
        assertEquals(
            selectTier({ historyDepth: 1, questionTokens: 20, historyTokens: 430, contextTokens: CTX, totalTokens: 6100 }),
            "MEDIUM",
        );
    });

    it("routes depth-2 turns to MEDIUM when the score is moderate", () => {
        // Two small turns: score = 20 + 200 + 420 = 640 ≤ DEPTH2_MEDIUM_MAX (1500)
        assertEquals(
            selectTier({ historyDepth: 2, questionTokens: 20, historyTokens: 200, contextTokens: CTX, totalTokens: 7000 }),
            "MEDIUM",
        );
    });

    it("routes depth-2 turns to HEAVY when the score exceeds the MEDIUM ceiling", () => {
        // Two full turns of history: score = 20 + 1600 + 420 = 2040 > 1500
        assertEquals(
            selectTier({ historyDepth: 2, questionTokens: 20, historyTokens: 1600, contextTokens: CTX, totalTokens: 8500 }),
            "HEAVY",
        );
    });

    it("routes depth 3+ turns to HEAVY", () => {
        assertEquals(
            selectTier({ historyDepth: 3, questionTokens: 4, historyTokens: 90, contextTokens: CTX, totalTokens: 9000 }),
            "HEAVY",
        );
    });

    // Capability guards override everything
    it("routes very long questions to HEAVY even in a fresh conversation", () => {
        assertEquals(
            selectTier({ historyDepth: 0, questionTokens: 250, historyTokens: 0, contextTokens: CTX, totalTokens: 4900 }),
            "HEAVY",
        );
    });

    it("routes very large contexts to HEAVY regardless of depth", () => {
        assertEquals(
            selectTier({ historyDepth: 0, questionTokens: 4, historyTokens: 0, contextTokens: 15000, totalTokens: 15500 }),
            "HEAVY",
        );
    });

    it("routes prompts over the hard budget to HEAVY", () => {
        assertEquals(
            selectTier({ historyDepth: 0, questionTokens: 4, historyTokens: 0, contextTokens: CTX, totalTokens: 35000 }),
            "HEAVY",
        );
    });
});
