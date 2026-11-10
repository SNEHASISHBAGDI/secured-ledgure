import { apiClient } from './client';
import {
  CreateTransactionPayload,
  CreateTransactionResponse,
  TransactionHistoryResponse,
} from '../types/transaction';

/**
 * POST /api/transactions/
 * Submits an atomic transfer between ledger accounts.
 */
export async function createTransactionApi(
  payload: CreateTransactionPayload
): Promise<CreateTransactionResponse> {
  return apiClient.post<CreateTransactionResponse>('/transactions/', payload);
}

/**
 * GET /api/transactions/
 * Retrieves transaction history scoped to the authenticated user's accounts.
 */
export async function getTransactionsApi(params?: {
  page?: number;
  limit?: number;
  type?: 'ALL' | 'CREDIT' | 'DEBIT';
  search?: string;
}): Promise<TransactionHistoryResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', params.page.toString());
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.type && params.type !== 'ALL') query.set('type', params.type);
  if (params?.search && params.search.trim()) query.set('search', params.search.trim());

  const qs = query.toString();
  return apiClient.get<TransactionHistoryResponse>(`/transactions/${qs ? `?${qs}` : ''}`);
}
