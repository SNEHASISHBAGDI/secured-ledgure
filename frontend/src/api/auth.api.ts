import { apiClient } from './client';
import { AuthResponse, LoginCredentials, RegisterCredentials } from '../types/auth';

/**
 * POST /api/auth/register
 */
export async function registerApi(credentials: RegisterCredentials): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/auth/register', {
    name: credentials.name.trim(),
    email: credentials.email.trim(),
    password: credentials.password,
  });
}

/**
 * POST /api/auth/login
 */
export async function loginApi(credentials: LoginCredentials): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/auth/login', {
    email: credentials.email.trim(),
    password: credentials.password,
  });
}

/**
 * POST /api/auth/logout
 */
export async function logoutApi(): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>('/auth/logout');
}
