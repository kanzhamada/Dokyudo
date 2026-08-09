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
	UpdateTurnFeedbackResponse,
	DeleteTurnResponse,
	BranchConversationResponse,
	CreateShareParams,
	CreateShareResponse,
	PublicShare,
	ContinueShareResponse,
	ShareListItem
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

/**
 * Deletes a single turn (question and response) from a conversation.
 */
export function deleteTurn(
	conversationId: string,
	turnId: string
): Promise<ApiResult<DeleteTurnResponse>> {
	return apiRequest<DeleteTurnResponse>(
		`/api/rag/conversations/${conversationId}/turns/${turnId}`,
		{ method: 'DELETE' }
	);
}

/**
 * Creates a new conversation that branches from the given turn — copies the
 * history up to (and including) that turn, marked as a branch of the source.
 */
export function branchConversation(
	conversationId: string,
	turnId: string
): Promise<ApiResult<BranchConversationResponse>> {
	return apiRequest<BranchConversationResponse>(`/api/rag/conversations/${conversationId}/branch`, {
		method: 'POST',
		body: { turn_id: turnId }
	});
}

// =============================================================================
// Public Share
// =============================================================================

/**
 * Creates a public read-only share of the conversation (snapshot up to its
 * last turn). Returns the short code — compose the URL as `${origin}/s/${code}`.
 */
export function createShare(
	conversationId: string,
	params: CreateShareParams = {}
): Promise<ApiResult<CreateShareResponse>> {
	return apiRequest<CreateShareResponse>(`/api/rag/conversations/${conversationId}/share`, {
		method: 'POST',
		body: {
			...(params.expiresInHours !== undefined ? { expires_in_hours: params.expiresInHours } : {}),
			...(params.customCode ? { custom_code: params.customCode } : {})
		}
	});
}

/**
 * Public (unauthenticated) read of a share link. Safe to call without a
 * session — the backend ignores the token when present.
 */
export function getPublicShare(code: string): Promise<ApiResult<PublicShare>> {
	return apiRequest<PublicShare>(`/api/rag/shares/${code}`, { method: 'GET' });
}

/**
 * Authenticated: rebuilds a new conversation from the share's snapshot.
 */
export function continueShare(code: string): Promise<ApiResult<ContinueShareResponse>> {
	return apiRequest<ContinueShareResponse>(`/api/rag/shares/${code}/continue`, {
		method: 'POST'
	});
}

/**
 * Revokes a single share link.
 */
export function deleteShare(code: string): Promise<ApiResult<DeleteConversationResponse>> {
	return apiRequest<DeleteConversationResponse>(`/api/rag/shares/${code}`, {
		method: 'DELETE'
	});
}

/**
 * Revokes every active share of a conversation ("stop sharing").
 */
export function deleteAllShares(
	conversationId: string
): Promise<ApiResult<{ success: boolean; deleted: number }>> {
	return apiRequest<{ success: boolean; deleted: number }>(
		`/api/rag/conversations/${conversationId}/shares`,
		{ method: 'DELETE' }
	);
}

/**
 * Lists the active share links of a conversation.
 */
export function listShares(
	conversationId: string
): Promise<ApiResult<{ shares: ShareListItem[] }>> {
	return apiRequest<{ shares: ShareListItem[] }>(
		`/api/rag/conversations/${conversationId}/shares`,
		{ method: 'GET' }
	);
}
