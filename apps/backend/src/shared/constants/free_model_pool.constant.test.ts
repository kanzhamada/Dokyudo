import { describe, it } from "jsr:@std/testing/bdd";
import { assertEquals } from "jsr:@std/assert";
import { selectTier } from "./free_model_pool.constant.ts";

describe("selectTier", () => {
    // Primary signal: conversation history depth
    it("routes fresh conversations (0 previous turns) to LIGHT", () => {
        assertEquals(
            selectTier({ historyDepth: 0, questionTokens: 4, contextTokens: 4200, totalTokens: 4539 }),
            "LIGHT",
        );
        assertEquals(
            selectTier({ historyDepth: 0, questionTokens: 19, contextTokens: 4300, totalTokens: 4652 }),
            "LIGHT",
        );
    });

    it("routes 1–2 previous turns to MEDIUM", () => {
        assertEquals(
            selectTier({ historyDepth: 1, questionTokens: 4, contextTokens: 4200, totalTokens: 6100 }),
            "MEDIUM",
        );
        assertEquals(
            selectTier({ historyDepth: 2, questionTokens: 19, contextTokens: 4300, totalTokens: 7800 }),
            "MEDIUM",
        );
    });

    it("routes 3 previous turns to HEAVY", () => {
        assertEquals(
            selectTier({ historyDepth: 3, questionTokens: 4, contextTokens: 4200, totalTokens: 9000 }),
            "HEAVY",
        );
    });

    // Guards override the depth-based classification
    it("routes very long questions to HEAVY even in a fresh conversation", () => {
        assertEquals(
            selectTier({ historyDepth: 0, questionTokens: 250, contextTokens: 4200, totalTokens: 4900 }),
            "HEAVY",
        );
    });

    it("routes very large contexts to HEAVY regardless of history depth", () => {
        assertEquals(
            selectTier({ historyDepth: 0, questionTokens: 4, contextTokens: 15000, totalTokens: 15500 }),
            "HEAVY",
        );
    });

    it("routes prompts over the hard budget to HEAVY", () => {
        assertEquals(
            selectTier({ historyDepth: 0, questionTokens: 4, contextTokens: 4200, totalTokens: 35000 }),
            "HEAVY",
        );
    });
});
