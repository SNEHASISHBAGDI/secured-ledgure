export type AccountStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';

export interface Account {
  _id: string;
  user: string;
  status: AccountStatus;
  currency: string;
  createdAt: string;
  updatedAt: string;
  /** Balance stored and returned in integer paise (1 INR = 100 paise). Divide by 100 for display. */
  balance?: number;
  balanceLoading?: boolean;
}

export interface AccountsResponse {
  accounts: Account[];
}

export interface CreateAccountResponse {
  account: Account;
}

export interface AccountBalanceResponse {
  accountId: string;
  /** Balance in exact integer paise (1 INR = 100 paise). */
  balance: number;
  currency?: string;
  unit?: 'PAISE';
}
