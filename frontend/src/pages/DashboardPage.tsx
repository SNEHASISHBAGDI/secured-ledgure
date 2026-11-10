import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { WelcomeBanner } from '../components/dashboard/WelcomeBanner';
import { AccountSummary } from '../components/dashboard/AccountSummary';
import { AccountCard } from '../components/dashboard/AccountCard';
import { QuickActions } from '../components/dashboard/QuickActions';
import {
  RecentActivityUnavailable,
  SpendingOverviewUnavailable,
} from '../components/dashboard/RecentActivityUnavailable';
import { CreateAccountModal } from '../components/accounts/CreateAccountModal';
import { AccountDetailModal } from '../components/accounts/AccountDetailModal';
import { Button } from '../components/common/Button';
import { Skeleton } from '../components/common/Skeleton';
import { getUserAccountsApi, getAccountBalanceApi } from '../api/accounts.api';
import { Account } from '../types/account';
import { PlusCircle, RefreshCw, AlertCircle, CreditCard } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedAccountForDetail, setSelectedAccountForDetail] = useState<Account | null>(null);

  const fetchAccountsAndBalances = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getUserAccountsApi();
      const rawAccounts = data.accounts || [];

      // Initial state with balanceLoading = true
      const initialAccounts: Account[] = rawAccounts.map((acc) => ({
        ...acc,
        balanceLoading: true,
      }));
      setAccounts(initialAccounts);
      setIsLoading(false);

      // Concurrently fetch balance for each account using GET /api/accounts/balance/:accountId
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
      setError(
        err instanceof Error ? err.message : 'Failed to fetch accounts from ledger. Please retry.'
      );
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccountsAndBalances();
  }, [fetchAccountsAndBalances]);

  const handleAccountCreated = (newAccount: Account) => {
    // Add new account and fetch its initial balance
    setAccounts((prev) => [
      { ...newAccount, balance: 0, balanceLoading: false },
      ...prev,
    ]);
  };

  return (
    <AppLayout
      title="Dashboard"
      subtitle="Overview of accounts, balances, and ledger activity"
    >
      <div className="space-y-6">
        {/* Welcome Section */}
        <WelcomeBanner />

        {/* Global Error Notice if loading failed */}
        {error && (
          <div className="p-4 rounded-xl bg-status-error/15 border border-status-error/30 flex items-center justify-between text-xs sm:text-sm text-status-error">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchAccountsAndBalances}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Account Summary Metrics */}
        <AccountSummary
          accounts={accounts}
          isLoading={isLoading}
          onOpenCreateModal={() => setIsCreateModalOpen(true)}
        />

        {/* Quick Actions */}
        <QuickActions />

        {/* Your Accounts Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-txt-secondary uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-secondary" />
              <span>Your Accounts ({accounts.length})</span>
            </h3>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchAccountsAndBalances}
                className="p-1.5 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-surface-elevated text-xs flex items-center gap-1 transition-colors"
                title="Refresh balances"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <Button
                size="sm"
                variant="outline"
                leftIcon={<PlusCircle className="w-3.5 h-3.5 text-secondary" />}
                onClick={() => setIsCreateModalOpen(true)}
              >
                New Account
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Skeleton height={170} />
              <Skeleton height={170} />
              <Skeleton height={170} />
            </div>
          ) : accounts.length === 0 ? (
            <div className="p-8 sm:p-12 rounded-card bg-surface-card border border-border text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-surface-elevated border border-border flex items-center justify-center text-txt-muted">
                <CreditCard className="w-6 h-6 text-secondary" />
              </div>
              <h4 className="text-base font-semibold text-txt-primary">No Accounts Found</h4>
              <p className="text-xs text-txt-muted max-w-sm">
                You have not opened any ledger accounts yet. Open your first account to begin
                receiving and sending funds.
              </p>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<PlusCircle className="w-4 h-4" />}
                onClick={() => setIsCreateModalOpen(true)}
              >
                Open Your First Account
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

        {/* Bottom Split: Recent Activity & Spending Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentActivityUnavailable />
          <SpendingOverviewUnavailable />
        </div>
      </div>

      {/* Modals */}
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
