import { GoogleGenAI } from "@google/genai";
import { AppError } from "../../shared/utils/errors.util.ts";
import { getEnv } from "../../config/env.ts";
import { type LlmProvider, isValidModelForProvider } from "./llm_models.ts";

export interface StreamResponse {
    stream: AsyncIterable<{ text: string }>;
}

export class LlmRouterService {
    /**
     * Executes the generation using the selected provider, model, and optional BYOK API Key.
     * Returns an async iterable of chunks.
     */
    static async generateStream(params: {
        provider: LlmProvider;
        model: string;
        prompt: string;
        apiKey?: string;
    }): Promise<StreamResponse> {

        if (!isValidModelForProvider(params.provider, params.model)) {
            throw new AppError({
                code: "VALIDATION_ERROR",
                message: `Model "${params.model}" is not supported for provider "${params.provider}"`,
                status: 400,
            });
        }

        switch (params.provider) {
            case "gemini":
                return this.streamGemini(params.model, params.prompt, params.apiKey);
            case "mistral":
                return this.streamMistral(params.model, params.prompt, params.apiKey);
            case "openrouter":
                return this.streamOpenRouter(params.model, params.prompt, params.apiKey);
            default:
                throw new AppError({ code: "VALIDATION_ERROR", message: "Unsupported provider", status: 400 });
        }
    }

    private static async streamGemini(model: string, prompt: string, apiKey?: string): Promise<StreamResponse> {
        const key = apiKey || getEnv("GOOGLE_API_KEY");
        const client = new GoogleGenAI({ apiKey: key });

        const stream = await client.models.generateContentStream({
            model: model,
            contents: prompt,
        });

        // Map it to common format
        async function* mappedStream() {
            for await (const chunk of stream) {
                if (chunk.text) {
                    yield { text: chunk.text };
                }
            }
        }

        return { stream: mappedStream() };
    }

    private static async streamMistral(model: string, prompt: string, apiKey?: string): Promise<StreamResponse> {
        if (!apiKey) {
            throw new AppError({ code: "UNAUTHORIZED", message: "Mistral BYOK API key is required", status: 401 });
        }
        
        // Dynamic import to avoid errors if SDK is not installed or available
        const { Mistral } = await import("npm:@mistralai/mistralai");
        const client = new Mistral({ apiKey });

        const responseStream = await client.chat.stream({
            model: model,
            messages: [{ role: "user", content: prompt }]
        });

        async function* mappedStream() {
            for await (const chunk of responseStream) {
                if (chunk.data.choices && chunk.data.choices[0]?.delta?.content) {
                    yield { text: chunk.data.choices[0].delta.content as string };
                }
            }
        }

        return { stream: mappedStream() };
    }

    private static async streamOpenRouter(model: string, prompt: string, apiKey?: string): Promise<StreamResponse> {
        if (!apiKey) {
            throw new AppError({ code: "UNAUTHORIZED", message: "OpenRouter BYOK API key is required", status: 401 });
        }

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "HTTP-Referer": "https://dokyudo.com", // Adjust as needed
                "X-OpenRouter-Title": "Dokyudo",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: model,
                stream: true,
                messages: [{ role: "user", content: prompt }]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new AppError({ code: "PROVIDER_UNAVAILABLE", message: `OpenRouter error: ${errorText}`, status: 502 });
        }

        if (!response.body) {
            throw new AppError({ code: "PROVIDER_UNAVAILABLE", message: "Empty stream from OpenRouter", status: 502 });
        }

        // Parse SSE from OpenRouter
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        async function* mappedStream() {
            let buffer = "";
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";
                
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith("data: ")) {
                        const dataStr = trimmedLine.substring(6);
                        if (dataStr === "[DONE]") {
                            return;
                        }
                        try {
                            const data = JSON.parse(dataStr);
                            const content = data.choices?.[0]?.delta?.content;
                            if (content) {
                                yield { text: content };
                            }
                        } catch (e) {
                            // ignore parse error for partial streams
                        }
                    }
                }
            }
        }

        return { stream: mappedStream() };
    }
}
