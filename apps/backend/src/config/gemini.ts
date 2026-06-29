import { GoogleGenAI } from "@google/genai";
import { getEnv } from "./env.ts";

export const GEMINI_MODELS = {
    embedding: "gemini-embedding-2",
    // llm: "gemini-2.5-flash",
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
     * Future LLM generation methods (e.g., generateText) can be added here
     * using GEMINI_MODELS.llm
     */
}

export const gemini = new GeminiClient();
