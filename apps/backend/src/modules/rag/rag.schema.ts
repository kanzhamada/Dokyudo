import { z } from "zod";

export const ChatBodySchema = z.object({
    question: z.string().min(1, "Question cannot be empty").max(690, "Question is too long (maximum 690 characters)"),
    conversation_id: z.string().uuid().optional(),
});
export type ChatBody = z.infer<typeof ChatBodySchema>;

export interface ChatServiceParams {
    tenantId: string;
    userId: string;
    question: string;
    conversationId?: string;
    logContext?: Record<string, any>;
}

export const ConversationParamSchema = z.object({
    id: z.string().uuid("Invalid conversation ID"),
});

export const UpdateConversationBodySchema = z.object({
    title: z.string().min(1, "Title cannot be empty").max(100, "Title is too long"),
});
export type UpdateConversationBody = z.infer<typeof UpdateConversationBodySchema>;
