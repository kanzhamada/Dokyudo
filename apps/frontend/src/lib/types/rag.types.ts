export interface ConversationItem {
	id: string;
	title: string;
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
	title: string;
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
	title?: string;
	pages: number[];
}

export type TurnStatus = 'processing' | 'complete' | 'stopped' | 'failed' | 'blocked';

export interface ConversationTurn {
	id: string;
	question: string;
	answer: string;
	status: TurnStatus;
	feedback: 'good' | 'bad' | null;
	feedbackAt?: string | null;
	modelUsed: string | null;
	contextReferences: ContextReference[] | null;
	createdAt: string;
	updatedAt?: string;
}

export interface GetConversationResponse {
	id: string;
	title: string;
	createdAt: string;
	updatedAt: string;
	turns: ConversationTurn[];
}

