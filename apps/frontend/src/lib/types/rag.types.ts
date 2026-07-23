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
