import { z } from "zod";

export const ChatBodySchema = z.object({
    question: z.string().min(1, "Question cannot be empty").max(690, "Question is too long (maximum 690 characters)"),
    conversation_id: z.string().uuid().optional(),
    provider: z.enum(["gemini", "mistral", "openrouter"]).optional(),
    model: z.string().optional(),
    useByok: z.boolean().default(false),
    /**
     * When set, the streamed answer overwrites this existing turn (edit mode)
     * instead of inserting a new turn. Requires `conversation_id`.
     */
    edit_turn_id: z.string().uuid("Invalid turn ID").optional(),
});
export type ChatBody = z.infer<typeof ChatBodySchema>;

export type TurnStatus = "processing" | "complete" | "stopped" | "failed" | "blocked";

export interface ChatServiceParams {
    tenantId: string;
    userId: string;
    question: string;
    conversationId?: string;
    provider?: "gemini" | "mistral" | "openrouter";
    model?: string;
    useByok: boolean;
    editTurnId?: string;
    signal?: AbortSignal;
    logContext?: Record<string, any>;
}

export const ConversationParamSchema = z.object({
    id: z.string().uuid("Invalid conversation ID"),
});

export const TurnFeedbackParamSchema = ConversationParamSchema.extend({
    turnId: z.string().uuid("Invalid turn ID"),
});

export const TurnFeedbackBodySchema = z.object({
    rating: z.enum(["good", "bad"]).nullable(),
});
export type TurnFeedbackBody = z.infer<typeof TurnFeedbackBodySchema>;

export const UpdateConversationBodySchema = z.object({
    title: z.string().min(1, "Title cannot be empty").max(100, "Title is too long").optional(),
    isPinned: z.boolean().optional(),
}).refine((data) => data.title !== undefined || data.isPinned !== undefined, {
    message: "At least one of 'title' or 'isPinned' must be provided",
});
export type UpdateConversationBody = z.infer<typeof UpdateConversationBodySchema>;

export const BranchConversationBodySchema = z.object({
    /** The boundary turn: history up to (and including) this turn is copied. */
    turn_id: z.string().uuid("Invalid turn ID"),
});
export type BranchConversationBody = z.infer<typeof BranchConversationBodySchema>;

export const BranchOfSchema = z.object({
    id: z.string().uuid(),
    title: z.string(),
});
export type BranchOf = z.infer<typeof BranchOfSchema>;

export const ConversationItemSchema = z.object({
    id: z.string().uuid(),
    title: z.string(),
    isPinned: z.boolean(),
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
    status: z.enum(["processing", "complete", "stopped", "failed", "blocked"]),
    feedback: z.enum(["good", "bad"]).nullable().optional(),
    feedbackAt: z.string().nullable().optional(),
    /** Set only on the boundary turn of a branched conversation. */
    branchedFromTurnId: z.string().uuid().nullable().optional(),
    contextReferences: z.array(ContextReferenceSchema).nullable(),
    createdAt: z.string(),
    updatedAt: z.string().optional(),
});
export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;

export const GetConversationResponseSchema = ConversationItemSchema.extend({
    /** Parent conversation when this one is a branch. Null otherwise. */
    branchOf: BranchOfSchema.nullable().optional(),
    turns: z.array(ConversationTurnSchema),
});
export type GetConversationResponse = z.infer<typeof GetConversationResponseSchema>;

