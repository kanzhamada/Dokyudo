import { GoogleGenAI } from "@google/genai";
import { getEnv } from "./env.ts";

export const GEMINI_MODELS = {
    embedding: "gemini-embedding-2",
    llmDefault: "gemini-3.1-flash-lite",
    llmFallbackChain: [
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash-lite",
        "gemini-3-flash",
        "gemini-3.5-flash",
        "gemini-2.5-flash",
    ],
} as const;

class GeminiClient {
    private client: GoogleGenAI;

    constructor() {
        this.client = new GoogleGenAI({
            apiKey: getEnv("GOOGLE_API_KEY"),
        });
    }

    /**
     * Generate a vector embedding for a given text.
     * Dimensions are strictly clamped to 768 to comply with Upstash Vector limits.
     */
    async generateEmbedding(text: string): Promise<number[]> {
        const response = await this.client.models.embedContent({
            model: GEMINI_MODELS.embedding,
            contents: text,
            config: { outputDimensionality: 768 }
        });
        
        const values = response.embeddings[0].values;
        if (values.length !== 768) {
            throw new Error(`Embedding API returned ${values.length} dimensions, expected 768.`);
        }
        return values;
    }

    /**
     * Generate a streaming text response from the LLM.
     * Accepts an optional model parameter for fallback purposes.
     */
    async generateTextStream(prompt: string, model: string = GEMINI_MODELS.llmDefault) {
        return await this.client.models.generateContentStream({
            model: model,
            contents: prompt,
        });
    }

    /**
     * Generate a full text response (non-streaming) from the LLM.
     * Useful for quick classification or gatekeeping tasks.
     */
    async generateText(prompt: string, model: string = GEMINI_MODELS.llmDefault) {
        return await this.client.models.generateContent({
            model: model,
            contents: prompt,
        });
    }
}

export const gemini = new GeminiClient();
