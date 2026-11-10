import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { TransferForm } from '../components/transactions/TransferForm';
import { getUserAccountsApi, getAccountBalanceApi } from '../api/accounts.api';
import { Account } from '../types/account';
import { Skeleton } from '../components/common/Skeleton';
import { AlertCircle } from 'lucide-react';
import { Button } from '../components/common/Button';

export const TransferPage: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const data = await getUserAccountsApi();
      const rawAccounts = data.accounts || [];

      // Concurrently fetch balance for each account
      const accountsWithBalances = await Promise.all(
        rawAccounts.map(async (acc) => {
          try {
            const balanceRes = await getAccountBalanceApi(acc._id);
            return { ...acc, balance: balanceRes.balance };
          } catch {
            return { ...acc, balance: 0 };
          }
        })
      );

      setAccounts(accountsWithBalances);
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Failed to load accounts for transfer.');
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchAccounts(false);
  }, []);

  return (
    <AppLayout
      title="Transfer Money"
      subtitle="Send funds securely between verified ledger accounts"
    >
      <div className="space-y-6">
        {isLoading ? (
          <div className="max-w-2xl mx-auto space-y-4">
            <Skeleton height={80} />
            <Skeleton height={380} />
          </div>
        ) : error ? (
          <div className="max-w-2xl mx-auto p-4 rounded-xl bg-status-error/15 border border-status-error/30 flex items-center justify-between text-xs text-status-error">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button size="sm" variant="outline" onClick={() => fetchAccounts(false)}>
              Retry
            </Button>
          </div>
        ) : (
          <TransferForm accounts={accounts} onSuccess={() => fetchAccounts(true)} />
        )}
      </div>
    </AppLayout>
  );
};
