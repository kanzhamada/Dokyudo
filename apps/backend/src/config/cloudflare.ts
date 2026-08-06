import { getEnv } from "./env.ts";

export const CLOUDFLARE_MODELS = {
    embedding: "@cf/baai/bge-m3",
} as const;

class CloudflareClient {
    private accountId: string;
    private apiToken: string;

    constructor() {
        this.accountId = getEnv("CLOUDFLARE_ACCOUNT_ID");
        this.apiToken = getEnv("CLOUDFLARE_AUTH_TOKEN");
    }

    /**
     * Generate a vector embedding for a given text using Cloudflare Workers AI.
     * Dimensions are expected to be 1024 for BGE-M3 (base, dense).
     */
    async generateEmbedding(text: string): Promise<number[]> {
        const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${CLOUDFLARE_MODELS.embedding}`;
        
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.apiToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text: [text]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Cloudflare API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(`Cloudflare API returned failure: ${JSON.stringify(data.errors)}`);
        }

        const values = data.result.data[0];
        
        if (values.length !== 1024) {
            throw new Error(`Embedding API returned ${values.length} dimensions, expected 1024.`);
        }
        
        return values;
    }
}

export const cloudflare = new CloudflareClient();
