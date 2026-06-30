import { AppError } from "../../shared/utils/errors.util.ts";
import { ChatServiceParams } from "./rag.schema.ts";
import { SearchService } from "../search/search.service.ts";
import { gemini, GEMINI_MODELS } from "../../config/gemini.ts";
import { createCircuitBreaker } from "../../infra/circuit_breaker.infra.ts";
import { withAuthDb } from "../../config/drizzle.ts";
import { conversations, conversationTurns } from "../../shared/models/db.model.ts";

export class RagService {
    /**
     * Executes RAG pipeline and returns an SSE ReadableStream.
     */
    static async streamChat(params: ChatServiceParams): Promise<ReadableStream> {
        const { tenantId, userId, question, conversationId, logContext } = params;

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
                let fullAnswer = "";
                let successfulModel = "";
                const startMs = Date.now();
                
                // Group unique pages per document ID
                const referencesMap = new Map<string, Set<number>>();
                for (const doc of searchResults) {
                    const docId = doc.documentId;
                    if (!referencesMap.has(docId)) referencesMap.set(docId, new Set());
                    
                    const meta = doc.metadata as { pages?: number[] } | null;
                    if (meta && Array.isArray(meta.pages)) {
                        for (const p of meta.pages) {
                            referencesMap.get(docId)!.add(p);
                        }
                    }
                }
                
                const references = Array.from(referencesMap.entries()).map(([docId, pagesSet]) => ({
                    documentId: docId,
                    pages: Array.from(pagesSet).sort((a, b) => a - b)
                }));

                for (const model of GEMINI_MODELS.llmFallbackChain) {
                    try {
                        const cb = createCircuitBreaker(`llm-gen-${model}`);
                        
                        // Circuit breaker protects the initial connection
                        const responseStream = await cb.execute(() => 
                            gemini.generateTextStream(augmentedPrompt, model)
                        );
                        
                        // Connection established, send references metadata first
                        controller.enqueue(
                            encoder.encode(`event: references\ndata: ${JSON.stringify({ references })}\n\n`)
                        );
                        
                        // Stream the tokens
                        for await (const chunk of responseStream) {
                            if (chunk.text) {
                                fullAnswer += chunk.text;
                                controller.enqueue(
                                    encoder.encode(`event: token\ndata: ${JSON.stringify({ token: chunk.text })}\n\n`)
                                );
                            }
                        }
                        
                        // Successfully streamed
                        success = true;
                        successfulModel = model;
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
                
                // Close controller first so client isn't waiting
                controller.close();
                
                // Save conversation_turn to DB asynchronously
                if (success) {
                    try {
                        const latencyMs = Date.now() - startMs;
                        let cid = conversationId;
                        
                        if (!cid) {
                            const [newConv] = await withAuthDb(userId, async (tx) => {
                                return await tx.insert(conversations).values({
                                    tenantId,
                                    title: question.substring(0, 50) || "New Conversation",
                                }).returning({ id: conversations.id });
                            });
                            cid = newConv.id;
                        }
                        
                        await withAuthDb(userId, async (tx) => {
                            await tx.insert(conversationTurns).values({
                                tenantId,
                                conversationId: cid!,
                                question,
                                answer: fullAnswer,
                                modelUsed: successfulModel,
                                latencyMs,
                                contextReferences: chunkIds.length > 0 ? chunkIds : null,
                            });
                        });
                        
                        if (logContext) {
                            logContext.ragEvent = "conversation_saved";
                            logContext.latencyMs = latencyMs;
                        }
                    } catch (dbErr: any) {
                        console.error("[RAG DB SAVE ERROR]:", dbErr);
                        if (logContext) {
                            logContext.ragEvent = "conversation_save_error";
                            logContext.ragError = dbErr.message;
                        }
                    }
                }
            }
        });

        return stream;
    }
}
