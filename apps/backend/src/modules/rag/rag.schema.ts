import { z } from "zod";

export const ChatBodySchema = z.object({
    question: z.string().min(1, "Question cannot be empty"),
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
