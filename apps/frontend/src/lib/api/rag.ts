import { apiRequest } from './client';
import type { ApiResult } from '../types/api.types';
import type {
	GetConversationsParams,
	GetConversationsResponse,
	GetConversationResponse,
	UpdateConversationParams,
	UpdateConversationResponse,
	DeleteConversationResponse,
	UpdateTurnFeedbackParams,
	UpdateTurnFeedbackResponse
} from '../types/rag.types';

/**
 * Fetches recent chat conversations for the sidebar with pagination support.
 */
export function getConversations(
	params: GetConversationsParams = {}
): Promise<ApiResult<GetConversationsResponse>> {
	const query = new URLSearchParams();
	if (params.limit) query.set('limit', params.limit.toString());
	if (params.cursor) query.set('cursor', params.cursor);

	const queryString = query.toString();
	const path = `/api/rag/conversations${queryString ? `?${queryString}` : ''}`;

	return apiRequest<GetConversationsResponse>(path, { method: 'GET' });
}

/**
 * Fetches a single conversation by ID including its turns.
 */
export function getConversation(id: string): Promise<ApiResult<GetConversationResponse>> {
	return apiRequest<GetConversationResponse>(`/api/rag/conversations/${id}`, { method: 'GET' });
}

/**
 * Updates a conversation title (Edit conversation).
 */
export function updateConversation(
	conversationId: string,
	params: UpdateConversationParams
): Promise<ApiResult<UpdateConversationResponse>> {
	return apiRequest<UpdateConversationResponse>(`/api/rag/conversations/${conversationId}`, {
		method: 'PATCH',
		body: params
	});
}

/**
 * Deletes a conversation by ID.
 */
export function deleteConversation(
	conversationId: string
): Promise<ApiResult<DeleteConversationResponse>> {
	return apiRequest<DeleteConversationResponse>(`/api/rag/conversations/${conversationId}`, {
		method: 'DELETE'
	});
}

/**
 * Sets or clears (rating=null) the user's good/bad feedback on a single turn.
 */
export function updateTurnFeedback(
	conversationId: string,
	turnId: string,
	params: UpdateTurnFeedbackParams
): Promise<ApiResult<UpdateTurnFeedbackResponse>> {
	return apiRequest<UpdateTurnFeedbackResponse>(
		`/api/rag/conversations/${conversationId}/turns/${turnId}/feedback`,
		{ method: 'PATCH', body: params }
	);
}

