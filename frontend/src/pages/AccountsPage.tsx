import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { AccountCard } from '../components/dashboard/AccountCard';
import { CreateAccountModal } from '../components/accounts/CreateAccountModal';
import { AccountDetailModal } from '../components/accounts/AccountDetailModal';
import { Button } from '../components/common/Button';
import { Skeleton } from '../components/common/Skeleton';
import { NoticeBanner } from '../components/common/NoticeBanner';
import { getUserAccountsApi, getAccountBalanceApi } from '../api/accounts.api';
import { Account } from '../types/account';
import { PlusCircle, RefreshCw, AlertCircle, CreditCard, ShieldCheck } from 'lucide-react';
import { formatPaise } from '../utils/currency';

export const AccountsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedAccountForDetail, setSelectedAccountForDetail] = useState<Account | null>(null);

  const fetchAccounts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getUserAccountsApi();
      const rawAccounts = data.accounts || [];

      const initialAccounts: Account[] = rawAccounts.map((acc) => ({
        ...acc,
        balanceLoading: true,
      }));
      setAccounts(initialAccounts);
      setIsLoading(false);

      // Concurrently fetch balance for each account
      const balancePromises = initialAccounts.map(async (acc) => {
        try {
          const balanceRes = await getAccountBalanceApi(acc._id);
          return { accountId: acc._id, balance: balanceRes.balance };
        } catch {
          return { accountId: acc._id, balance: 0 };
        }
      });

      const balances = await Promise.all(balancePromises);
      const balanceMap = new Map<string, number>();
      balances.forEach((b) => balanceMap.set(b.accountId, b.balance));

      setAccounts((prev) =>
        prev.map((acc) => ({
          ...acc,
          balance: balanceMap.get(acc._id) ?? 0,
          balanceLoading: false,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user accounts.');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleAccountCreated = (newAccount: Account) => {
    setAccounts((prev) => [{ ...newAccount, balance: 0, balanceLoading: false }, ...prev]);
  };

  // Sum compatible INR balances in exact integer paise (no floating-point math)
  const totalBalancePaiseINR = accounts.reduce((acc, account) => {
    if (account.currency === 'INR' && typeof account.balance === 'number') {
      return acc + account.balance;
    }
    return acc;
  }, 0);

  return (
    <AppLayout
      title="Accounts Portfolio"
      subtitle="Manage your registered ledger accounts and check balances"
    >
      <div className="space-y-6">
        {/* Overview Header banner */}
        <div className="p-6 rounded-card bg-surface-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-secondary uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-status-success" />
              <span>Verified Ledger Accounts</span>
            </div>
            <div className="mt-2 text-3xl font-extrabold text-txt-primary">
              {isLoading ? (
                <Skeleton width={160} height={36} />
              ) : (
                formatPaise(totalBalancePaiseINR, 'INR')
              )}
            </div>
            <p className="text-xs text-txt-muted mt-1">
              Combined ledger equity across {accounts.length} active{' '}
              {accounts.length === 1 ? 'account' : 'accounts'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={fetchAccounts}
              disabled={isLoading}
            >
              Sync
            </Button>
            <Button
              variant="primary"
              size="md"
              leftIcon={<PlusCircle className="w-4 h-4" />}
              onClick={() => setIsCreateModalOpen(true)}
            >
              Open New Account
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-status-error/15 border border-status-error/30 flex items-center justify-between text-xs text-status-error">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button size="sm" variant="outline" onClick={fetchAccounts}>
              Retry
            </Button>
          </div>
        )}

        {/* Informative notice on creation */}
        <NoticeBanner
          variant="info"
          title="Direct Double-Entry Settlement"
        >
          Each account maintains its own discrete balance derived dynamically by aggregating all
          credit and debit ledger entries. All balances are verified against database ledger records.
        </NoticeBanner>

        {/* Accounts List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-txt-secondary uppercase tracking-wider">
              Active Ledger Accounts
            </h3>
            <span className="text-xs text-txt-muted font-medium">
              Showing {accounts.length} of {accounts.length}
            </span>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Skeleton height={180} />
              <Skeleton height={180} />
              <Skeleton height={180} />
            </div>
          ) : accounts.length === 0 ? (
            <div className="p-12 rounded-card bg-surface-card border border-border text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-surface-elevated border border-border flex items-center justify-center text-txt-muted">
                <CreditCard className="w-6 h-6 text-secondary" />
              </div>
              <h4 className="text-base font-semibold text-txt-primary">No Accounts Found</h4>
              <p className="text-xs text-txt-muted max-w-sm">
                You haven&apos;t opened any accounts yet. Open a new ledger account to start
                transacting.
              </p>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<PlusCircle className="w-4 h-4" />}
                onClick={() => setIsCreateModalOpen(true)}
              >
                Open Account
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {accounts.map((account) => (
                <AccountCard
                  key={account._id}
                  account={account}
                  onViewDetails={(acc) => setSelectedAccountForDetail(acc)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateAccountModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onAccountCreated={handleAccountCreated}
      />

      <AccountDetailModal
        account={selectedAccountForDetail}
        isOpen={!!selectedAccountForDetail}
        onClose={() => setSelectedAccountForDetail(null)}
      />
    </AppLayout>
  );
};
