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
} as const;
