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
