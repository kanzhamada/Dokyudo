import { apiRequest } from './client';
import type { ApiResult } from '../types/api.types';

export interface KeyItemResponse {
	provider: string;
	maskedKey: string;
	models: string[];
	updatedAt: string;
}

export interface KeysListResponse {
	data: KeyItemResponse[];
}

export function getKeys(): Promise<ApiResult<KeysListResponse>> {
	return apiRequest<KeysListResponse>('/api/keys', { method: 'GET' });
}

export function upsertKey(
	provider: 'gemini' | 'mistral' | 'openrouter',
	apiKey: string
): Promise<ApiResult<{ data: { success: boolean } }>> {
	return apiRequest<{ data: { success: boolean } }>('/api/keys', {
		method: 'PUT',
		body: { provider, apiKey }
	});
}

export function deleteKey(
	provider: 'gemini' | 'mistral' | 'openrouter'
): Promise<ApiResult<{ data: { success: boolean } }>> {
	return apiRequest<{ data: { success: boolean } }>(`/api/keys/${provider}`, {
		method: 'DELETE'
	});
}

export interface TestKeyResponse {
	valid: boolean;
	message: string;
}

export function testKey(
	provider: 'gemini' | 'mistral' | 'openrouter',
	apiKey: string
): Promise<ApiResult<{ data: TestKeyResponse }>> {
	return apiRequest<{ data: TestKeyResponse }>('/api/keys/test', {
		method: 'POST',
		body: { provider, apiKey }
	});
}
