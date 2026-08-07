import { describe, it } from "jsr:@std/testing/bdd";
import { assertEquals } from "jsr:@std/assert";
import { selectTier } from "./free_model_pool.constant.ts";

describe("selectTier", () => {
    it("routes short questions (chit-chat / short Q&A) to LIGHT", () => {
        // e.g. "Siapa nama saya?" ≈ 4 tokens + typical 4.5K RAG context
        assertEquals(
            selectTier({ questionTokens: 4, contextTokens: 4200, totalTokens: 4539 }),
            "LIGHT",
        );
        assertEquals(
            selectTier({ questionTokens: 19, contextTokens: 4300, totalTokens: 4652 }),
            "LIGHT",
        );
    });

    it("routes standard-length questions to MEDIUM", () => {
        // e.g. a 300-char question ≈ 75 tokens
        assertEquals(
            selectTier({ questionTokens: 75, contextTokens: 4200, totalTokens: 4700 }),
            "MEDIUM",
        );
    });

    it("routes long/complex questions to HEAVY", () => {
        // e.g. a 1000-char question ≈ 250 tokens
        assertEquals(
            selectTier({ questionTokens: 250, contextTokens: 4200, totalTokens: 4900 }),
            "HEAVY",
        );
    });

    it("routes very large contexts to HEAVY regardless of question length", () => {
        assertEquals(
            selectTier({ questionTokens: 4, contextTokens: 15000, totalTokens: 15500 }),
            "HEAVY",
        );
    });

    it("routes prompts over the hard budget to HEAVY", () => {
        assertEquals(
            selectTier({ questionTokens: 4, contextTokens: 4200, totalTokens: 35000 }),
            "HEAVY",
        );
    });

    it("boundary: exactly LIGHT_MAX stays LIGHT, one token more goes MEDIUM", () => {
        assertEquals(
            selectTier({ questionTokens: 40, contextTokens: 4200, totalTokens: 4600 }),
            "LIGHT",
        );
        assertEquals(
            selectTier({ questionTokens: 41, contextTokens: 4200, totalTokens: 4600 }),
            "MEDIUM",
        );
    });
});
