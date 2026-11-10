import React from 'react';
import { Wallet, CreditCard, PlusCircle, ArrowUpRight } from 'lucide-react';
import { Account } from '../../types/account';
import { formatPaise } from '../../utils/currency';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Skeleton } from '../common/Skeleton';
import { Link } from 'react-router-dom';

interface AccountSummaryProps {
  accounts: Account[];
  isLoading: boolean;
  onOpenCreateModal: () => void;
}

export const AccountSummary: React.FC<AccountSummaryProps> = ({
  accounts,
  isLoading,
  onOpenCreateModal,
}) => {
  // Aggregate compatible INR account balances in exact integer paise (no floating-point math).
  const totalBalancePaiseINR = accounts.reduce((acc, account) => {
    if (account.currency === 'INR' && typeof account.balance === 'number') {
      return acc + account.balance;
    }
    return acc;
  }, 0);

  const activeAccountsCount = accounts.filter((a) => a.status === 'ACTIVE').length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
      {/* Total Balance Card */}
      <Card elevated className="relative overflow-hidden md:col-span-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-txt-secondary text-xs font-semibold uppercase tracking-wider">
              <Wallet className="w-4 h-4 text-secondary" />
              <span>Total Available Balance (INR)</span>
            </div>

            {isLoading ? (
              <div className="py-1">
                <Skeleton width={180} height={36} />
              </div>
            ) : (
              <div className="text-3xl sm:text-4xl font-extrabold text-txt-primary tracking-tight">
                {formatPaise(totalBalancePaiseINR, 'INR')}
              </div>
            )}

            <p className="text-xs text-txt-muted">
              {accounts.length === 0
                ? 'No active accounts found. Open a new ledger account below.'
                : `Aggregated across ${accounts.length} verified ${
                    accounts.length === 1 ? 'account' : 'accounts'
                  }`}
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
            <Button
              size="sm"
              variant="primary"
              leftIcon={<PlusCircle className="w-4 h-4" />}
              onClick={onOpenCreateModal}
            >
              Open New Account
            </Button>
            <Link to="/transfer">
              <Button
                size="sm"
                variant="secondary"
                fullWidth
                rightIcon={<ArrowUpRight className="w-4 h-4" />}
              >
                Transfer Funds
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Account Overview Stats Card */}
      <Card className="flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-txt-secondary uppercase tracking-wider">
              Linked Accounts
            </span>
            <div className="p-2 rounded-lg bg-primary/10 text-secondary">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>

          {isLoading ? (
            <div className="py-2">
              <Skeleton width={80} height={32} />
            </div>
          ) : (
            <div className="mt-2">
              <span className="text-3xl font-extrabold text-txt-primary">{accounts.length}</span>
              <span className="text-xs text-txt-muted ml-2">Total</span>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-border/80 flex items-center justify-between text-xs">
          <span className="text-txt-secondary">Active Status</span>
          <span className="text-status-success font-semibold">
            {isLoading ? '...' : `${activeAccountsCount} of ${accounts.length} Active`}
          </span>
        </div>
      </Card>
    </div>
  );
};
