/** Standard error envelope from backend */
export interface ApiError {
  code: string;
  message: string;
  requestId: string;
  retryAfter?: number;
}

export interface ApiErrorResponse {
  error: ApiError;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };
