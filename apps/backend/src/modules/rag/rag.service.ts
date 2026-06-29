import { AppError } from "../../shared/utils/errors.util.ts";
import { ChatServiceParams } from "./rag.schema.ts";
import { SearchService } from "../search/search.service.ts";
import { gemini, GEMINI_MODELS } from "../../config/gemini.ts";
import { createCircuitBreaker } from "../../infra/circuit_breaker.infra.ts";

export class RagService {
    /**
     * Executes RAG pipeline and returns an SSE ReadableStream.
     */
    static async streamChat(params: ChatServiceParams): Promise<ReadableStream> {
        const { tenantId, question, conversationId, logContext } = params;

        // 1. Retrieve Context via Hybrid Search
        const searchResults = await SearchService.executeHybridSearch({
            tenantId,
            query: question,
            limit: 5,
            logContext,
        });

        // 2. Context Engineering (RAG Context Engineer Skill)
        let contextText = "";
        const chunkIds: string[] = [];
        
        const len = searchResults.length;
        if (len > 0) {
            contextText = "CONTEXT DOCUMENTS:\n---\n";
            for (let i = 0; i < len; i++) {
                const doc = searchResults[i];
                chunkIds.push(doc.id);
                // Including documentId and rank for structured metadata
                contextText += `[Doc ID: ${doc.documentId} | Relevance Rank: ${i+1}]\n`;
                contextText += `${doc.content}\n---\n`;
            }
        } else {
            contextText = "No relevant documents found in the knowledge base.\n";
        }

        // 3. Construct Augmented Prompt with Structural Guardrails
        const augmentedPrompt = `
You are an intelligent, helpful, and concise technical assistant. 
Use the provided CONTEXT DOCUMENTS to answer the user's question. 
If the answer is not contained in the context, explicitly state that you do not have enough information, rather than hallucinating.

${contextText}

USER QUESTION:
${question}
        `.trim();

        // 4. Cascading Fallback & SSE Streaming
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                let success = false;

                for (const model of GEMINI_MODELS.llmFallbackChain) {
                    try {
                        const cb = createCircuitBreaker(`llm-gen-${model}`);
                        
                        // Circuit breaker protects the initial connection
                        const responseStream = await cb.execute(() => 
                            gemini.generateTextStream(augmentedPrompt, model)
                        );
                        
                        // Connection established, stream the tokens
                        for await (const chunk of responseStream) {
                            if (chunk.text) {
                                controller.enqueue(
                                    encoder.encode(`event: token\ndata: ${JSON.stringify({ token: chunk.text })}\n\n`)
                                );
                            }
                        }
                        
                        // Successfully streamed
                        success = true;
                        if (logContext) {
                            logContext.ragModelUsed = model;
                        }
                        break; // Exit the fallback loop
                        
                    } catch (error: any) {
                        if (logContext) {
                            logContext.ragEvent = `fallback_failed_${model}`;
                            logContext.ragError = error.message;
                        }
                        // Continue to the next model in the fallback chain
                    }
                }

                if (!success) {
                    // All models failed
                    controller.enqueue(
                        encoder.encode(`event: error\ndata: ${JSON.stringify({ code: "PROVIDER_UNAVAILABLE", message: "All LLM providers are unavailable" })}\n\n`)
                    );
                } else {
                    controller.enqueue(encoder.encode("event: done\ndata: [DONE]\n\n"));
                }
                
                // TODO: Save conversation_turn to DB in finally block or here
                controller.close();
            }
        });

        return stream;
    }
}
