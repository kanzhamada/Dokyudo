import { apiRequest } from './client';
import type { ApiResult } from '../types/api.types';
import type { LoginResponse, RegisterResponse } from '../types/auth.types';

export function authLogin(params: {
  email: string;
  password: string;
  recaptchaToken: string;
}): Promise<ApiResult<LoginResponse>> {
  return apiRequest<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: params,
  });
}

export function authRegister(params: {
  email: string;
  password: string;
  recaptchaToken: string;
}): Promise<ApiResult<RegisterResponse>> {
  return apiRequest<RegisterResponse>('/api/auth/register', {
    method: 'POST',
    body: params,
  });
}
