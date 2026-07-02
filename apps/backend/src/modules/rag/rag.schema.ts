import { z } from "zod";

export const ChatBodySchema = z.object({
    question: z.string().min(1, "Question cannot be empty").max(690, "Question is too long (maximum 690 characters)"),
    conversation_id: z.string().uuid().optional(),
    provider: z.enum(["gemini", "mistral", "openrouter"]).default("gemini"),
    model: z.string().default("gemini-2.5-flash"),
    useByok: z.boolean().default(false),
});
export type ChatBody = z.infer<typeof ChatBodySchema>;

export interface ChatServiceParams {
    tenantId: string;
    userId: string;
    question: string;
    conversationId?: string;
    provider: "gemini" | "mistral" | "openrouter";
    model: string;
    useByok: boolean;
    logContext?: Record<string, any>;
}

export const ConversationParamSchema = z.object({
    id: z.string().uuid("Invalid conversation ID"),
});

export const UpdateConversationBodySchema = z.object({
    title: z.string().min(1, "Title cannot be empty").max(100, "Title is too long"),
});
export type UpdateConversationBody = z.infer<typeof UpdateConversationBodySchema>;

export const ConversationItemSchema = z.object({
    id: z.string().uuid(),
    title: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
});
export type ConversationItem = z.infer<typeof ConversationItemSchema>;

export const ListConversationsQuerySchema = z.object({
    limit: z.coerce.number().min(1).max(100).default(20),
    cursor: z.string().datetime().optional(), // ISO string of updatedAt
});

export const ListConversationsResponseSchema = z.object({
    conversations: z.array(ConversationItemSchema),
    nextCursor: z.string().nullable().optional(),
});
export type ListConversationsResponse = z.infer<typeof ListConversationsResponseSchema>;

export const ContextReferenceSchema = z.object({
    documentId: z.string(),
    title: z.string().optional(),
    pages: z.array(z.number()),
});
export type ContextReference = z.infer<typeof ContextReferenceSchema>;

export const ConversationTurnSchema = z.object({
    id: z.string().uuid(),
    question: z.string(),
    answer: z.string(),
    modelUsed: z.string().nullable(),
    contextReferences: z.array(ContextReferenceSchema).nullable(),
    createdAt: z.string(),
});
export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;

export const GetConversationResponseSchema = ConversationItemSchema.extend({
    turns: z.array(ConversationTurnSchema),
});
export type GetConversationResponse = z.infer<typeof GetConversationResponseSchema>;

