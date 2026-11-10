export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';

export type TransactionDirection = 'CREDIT' | 'DEBIT' | 'SELF' | 'TRANSFER';

export interface Transaction {
  _id: string;
  fromAccount: string;
  toAccount: string;
  /** Stored and returned in exact integer paise (1 INR = 100 paise). */
  amount: number;
  unit?: 'PAISE';
  status: TransactionStatus;
  direction?: TransactionDirection;
  counterparty?: string;
  /** Omitted from server API responses to reduce exposure. */
  idempotencyKey?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateTransactionPayload {
  fromAccount: string;
  toAccount: string;
  /** Positive safe integer in minor units (paise). */
  amount: number;
  idempotencyKey: string;
}

export interface CreateTransactionResponse {
  message: string;
  transaction: Transaction;
}

export interface TransactionHistoryResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  totalPages: number;
}
