import { apiClient } from './client';
import { AccountBalanceResponse, AccountsResponse, CreateAccountResponse } from '../types/account';

/**
 * GET /api/accounts/
 * Retrieves all accounts of the logged-in user
 */
export async function getUserAccountsApi(): Promise<AccountsResponse> {
  return apiClient.get<AccountsResponse>('/accounts/');
}

/**
 * POST /api/accounts/
 * Creates a new account for the logged-in user (default currency: INR)
 */
export async function createAccountApi(): Promise<CreateAccountResponse> {
  return apiClient.post<CreateAccountResponse>('/accounts/', {});
}

/**
 * GET /api/accounts/balance/:accountId
 * Retrieves derived balance (in exact integer paise) for a specific account
 */
export async function getAccountBalanceApi(accountId: string): Promise<AccountBalanceResponse> {
  return apiClient.get<AccountBalanceResponse>(`/accounts/balance/${encodeURIComponent(accountId)}`);
}
