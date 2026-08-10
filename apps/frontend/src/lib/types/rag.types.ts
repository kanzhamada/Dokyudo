export interface ConversationItem {
	id: string;
	title: string;
	isPinned: boolean;
	/** True when the conversation currently has at least one active public share. */
	hasActiveShare: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface GetConversationsResponse {
	conversations: ConversationItem[];
	nextCursor: string | null;
}

export interface GetConversationsParams {
	limit?: number;
	cursor?: string;
}

export type UpdateConversationParams = {
	title?: string;
	isPinned?: boolean;
};

export interface UpdateConversationResponse {
	data: {
		success: boolean;
	};
}

export interface DeleteConversationResponse {
	data: {
		success: boolean;
	};
}

export type FeedbackRating = 'good' | 'bad';

export type UpdateTurnFeedbackParams = {
	rating: FeedbackRating | null;
};

export interface UpdateTurnFeedbackResponse {
	data: {
		success: boolean;
	};
}

export interface DeleteTurnResponse {
	data: {
		success: boolean;
	};
}

export interface ContextReference {
	documentId: string;
	/** Citation index used in [Doc N] tags — present in conversation references. */
	index?: number;
	title?: string;
	pages: number[];
}

export type TurnStatus =
	| 'processing'
	| 'awaiting_indexing'
	| 'complete'
	| 'stopped'
	| 'failed'
	| 'blocked';

export interface TurnAlternative {
	id: string;
	answer: string;
	status: TurnStatus;
	modelUsed: string | null;
	latencyMs: number | null;
	contextReferences: ContextReference[] | null;
	createdAt: string;
}

export interface ConversationTurn {
	id: string;
	question: string;
	answer: string;
	status: TurnStatus;
	feedback: 'good' | 'bad' | null;
	feedbackAt?: string | null;
	/** Set only on the boundary turn of a branched conversation. */
	branchedFromTurnId?: string | null;
	/** Attachment document ids scoping this turn's retrieval (awaiting turns). */
	attachmentDocumentIds?: string[] | null;
	modelUsed: string | null;
	contextReferences: ContextReference[] | null;
	/** Retry variants of this turn (terminal, non-empty answers only). */
	alternatives: TurnAlternative[];
	createdAt: string;
	updatedAt?: string;
}

export interface BranchOf {
	id: string;
	title: string;
}

export interface GetConversationResponse {
	id: string;
	title: string;
	isPinned: boolean;
	/** Parent conversation when this one is a branch. Null otherwise. */
	branchOf?: BranchOf | null;
	createdAt: string;
	updatedAt: string;
	turns: ConversationTurn[];
}

export type BranchConversationParams = {
	turn_id: string;
};

export interface BranchConversationResponse {
	id: string;
	title: string;
}

// =============================================================================
// Public Share
// =============================================================================

export interface CreateShareParams {
	/** Link lifetime in hours. Absent = never expires. Presets: 1 | 24 | 168 | 720. */
	expiresInHours?: number;
	/** Optional user-chosen short code (4-32 chars: letters, digits, '-', '_'). */
	customCode?: string;
	/** Email invitees for a private share (invite-only access). */
	emails?: string[];
	/** Send invite emails to the listed addresses immediately. */
	notify?: boolean;
}

export interface CreateShareResponse {
	code: string;
	/** Present when the share is private — embed in invite links as `?invite=`. */
	accessToken: string | null;
}

export interface PublicShareTurn {
	question: string;
	answer: string;
	modelUsed: string | null;
	status: 'complete' | 'stopped' | 'failed' | 'blocked';
	contextReferences: ContextReference[] | null;
	createdAt: string;
}

export interface PublicShare {
	code: string;
	title: string;
	authorName: string | null;
	/** True when the share is invite-only and gated behind an access token. */
	isPrivate: boolean;
	expiresAt: string | null;
	createdAt: string;
	/** Id of the original conversation — used by the "continue chat" flow. */
	conversationId: string;
	turns: PublicShareTurn[];
}

export interface ContinueShareResponse {
	id: string;
	title: string;
}

export interface ShareListItem {
	code: string;
	title: string;
	isCustom: boolean;
	/** True when invite-only. The owner's token lets them reopen private links. */
	isPrivate: boolean;
	accessToken: string | null;
	/** Source conversation — used for grouping in the account-level dialog. */
	conversationId: string;
	expiresAt: string | null;
	createdAt: string;
}
