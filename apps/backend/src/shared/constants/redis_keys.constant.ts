export async function hashTextSHA256(text: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const RedisKeys = {
    // Global embedding cache to prevent LLM roundtrips
    embeddingCache: async (model: string, text: string) => {
        const hash = await hashTextSHA256(text);
        return `embedding:v2:${model}:${hash}`;
    },

    // Free provider quota tracking
    // TTL: 60s for RPM, seconds-until-midnight for RPD
    llmRpmQuota: (provider: string, modelId: string): string =>
        `llm:quota:rpm:${provider}:${modelId}`,

    llmRpdQuota: (provider: string, modelId: string): string =>
        `llm:quota:rpd:${provider}:${modelId}`,

    // Circuit breaker: stores "OPEN" string when provider is tripped
    llmCircuitBreaker: (provider: string, modelId: string): string =>
        `llm:cb:${provider}:${modelId}`,
} as const;
