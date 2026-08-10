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
    /**
     * When set, the streamed answer is stored as a retry alternative (variant)
     * of this turn instead of inserting/overwriting a turn. Only allowed on the
     * latest turn of the conversation. Requires `conversation_id`.
     */
    retry_turn_id: z.string().uuid("Invalid turn ID").optional(),
    /**
     * When set on a normal (non-retry) follow-up, the answer of this variant is
     * used as the conversation history context for the latest turn, promoted
     * into the turn row on success, and unselected variants are deleted.
     */
    selected_variant_id: z.string().uuid("Invalid variant ID").optional(),
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
    retryTurnId?: string;
    selectedVariantId?: string;
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
    /** True when the conversation currently has at least one active public share. */
    hasActiveShare: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
});
export type ConversationItem = z.infer<typeof ConversationItemSchema>;

export const ContextReferenceSchema = z.object({
    documentId: z.string(),
    title: z.string().optional(),
    pages: z.array(z.number()),
});
export type ContextReference = z.infer<typeof ContextReferenceSchema>;

export const TurnAlternativeSchema = z.object({
    id: z.string().uuid(),
    answer: z.string(),
    status: z.enum(["processing", "complete", "stopped", "failed", "blocked"]),
    modelUsed: z.string().nullable().optional(),
    latencyMs: z.number().nullable().optional(),
    contextReferences: z.array(ContextReferenceSchema).nullable().optional(),
    createdAt: z.string(),
});
export type TurnAlternative = z.infer<typeof TurnAlternativeSchema>;

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
    /** Retry variants of this turn (terminal, non-empty answers only). */
    alternatives: z.array(TurnAlternativeSchema).default([]),
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

// ==============================================================================
// PUBLIC SHARE
// ==============================================================================

export const CreateShareBodySchema = z.object({
    /**
     * Link lifetime in hours (1h - 1 year). Absent/undefined = never expires.
     * Presets: 1 | 24 | 168 | 720.
     */
    expires_in_hours: z.number().int().min(1).max(8760).optional(),
    /**
     * Optional user-chosen short code (custom URL). 4-32 chars of letters,
     * digits, '-' or '_'. Absent = auto-generated base62 code.
     */
    custom_code: z
        .string()
        .regex(/^[a-zA-Z0-9_-]{4,32}$/)
        .optional(),
    /**
     * Optional email invitees for a private share. When present the share is
     * marked private and gated behind an access token sent to each invitee.
     * Emails are normalized (lowercased), deduplicated, and must not include
     * the sharer's own email.
     */
    emails: z.array(z.string().email()).max(100).optional(),
    /** Send invite emails to the listed addresses immediately. Default false. */
    notify: z.boolean().optional(),
});
export type CreateShareBody = z.infer<typeof CreateShareBodySchema>;

export const AddShareInviteesBodySchema = z.object({
    emails: z.array(z.string().email()).min(1).max(100),
    /** Send invite emails to the listed addresses immediately. Default false. */
    notify: z.boolean().optional(),
});
export type AddShareInviteesBody = z.infer<typeof AddShareInviteesBodySchema>;

export const ShareReadQuerySchema = z.object({
    /** Access token for private shares — present on invite links as `?invite=`. */
    invite: z.string().optional(),
});

export const ShareParamSchema = z.object({
    code: z
        .string()
        .min(3, "Invalid share code")
        .max(32, "Invalid share code")
        .regex(/^[a-zA-Z0-9_-]+$/, "Invalid share code"),
});

export const ShareCreatedResponseSchema = z.object({
    code: z.string(),
    /** Present when the share is private — embed in invite links as `?invite=`. */
    accessToken: z.string().nullable(),
});
export type ShareCreatedResponse = z.infer<typeof ShareCreatedResponseSchema>;

export const PublicShareTurnSchema = z.object({
    question: z.string(),
    answer: z.string(),
    modelUsed: z.string().nullable(),
    status: z.enum(["complete", "stopped", "failed", "blocked"]),
    contextReferences: z.array(ContextReferenceSchema).nullable(),
    createdAt: z.string(),
});
export type PublicShareTurn = z.infer<typeof PublicShareTurnSchema>;

export const PublicShareResponseSchema = z.object({
    code: z.string(),
    title: z.string(),
    authorName: z.string().nullable(),
    /** True when the share is invite-only and gated behind an access token. */
    isPrivate: z.boolean(),
    expiresAt: z.string().nullable(),
    createdAt: z.string(),
    /** Id of the original conversation — used by the "continue chat" flow. */
    conversationId: z.string().uuid(),
    turns: z.array(PublicShareTurnSchema),
});
export type PublicShareResponse = z.infer<typeof PublicShareResponseSchema>;

export const ContinueShareResponseSchema = z.object({
    id: z.string().uuid(),
    title: z.string(),
});
export type ContinueShareResponse = z.infer<typeof ContinueShareResponseSchema>;

export const ShareListItemSchema = z.object({
    code: z.string(),
    title: z.string(),
    isCustom: z.boolean(),
    /** True when invite-only. The owner's token lets them reopen private links. */
    isPrivate: z.boolean(),
    accessToken: z.string().nullable(),
    /** Source conversation — used for grouping in the account-level dialog. */
    conversationId: z.string().uuid(),
    expiresAt: z.string().nullable(),
    createdAt: z.string(),
});
export type ShareListItem = z.infer<typeof ShareListItemSchema>;

export const ShareListResponseSchema = z.object({
    shares: z.array(ShareListItemSchema),
});

export const ListConversationsQuerySchema = z.object({
    limit: z.coerce.number().min(1).max(100).default(20),
    // Opaque composite keyset cursor (JSON: { p: isPinned, u: updatedAt, i: id }).
    // The frontend passes it through verbatim — never inspected here.
    cursor: z.string().optional(),
});

export const ListConversationsResponseSchema = z.object({
    conversations: z.array(ConversationItemSchema),
    nextCursor: z.string().nullable().optional(),
});
export type ListConversationsResponse = z.infer<typeof ListConversationsResponseSchema>;
