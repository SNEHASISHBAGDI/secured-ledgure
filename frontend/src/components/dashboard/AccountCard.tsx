import React, { useState } from 'react';
import { Copy, Check, CreditCard, Shield, Info } from 'lucide-react';
import { Account } from '../../types/account';
import { formatPaise, maskAccountId } from '../../utils/currency';
import { formatDate } from '../../utils/date';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Skeleton } from '../common/Skeleton';

interface AccountCardProps {
  account: Account;
  onViewDetails?: (account: Account) => void;
}

export const AccountCard: React.FC<AccountCardProps> = ({ account, onViewDetails }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(account._id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusVariantMap = {
    ACTIVE: 'active' as const,
    FROZEN: 'frozen' as const,
    CLOSED: 'closed' as const,
  };

  return (
    <Card hoverEffect className="relative flex flex-col justify-between group overflow-hidden">
      {/* Decorative gradient corner */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none group-hover:bg-primary/10 transition-colors" />

      <div>
        {/* Top line: Icon, Masked ID, Copy, Status Badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-surface-elevated border border-border text-secondary">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-sm font-semibold text-txt-primary">
                  {maskAccountId(account._id)}
                </span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  title="Copy full account ID"
                  className="p-1 text-txt-muted hover:text-txt-primary hover:bg-surface-elevated rounded transition-colors"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-status-success" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <span className="text-[11px] text-txt-muted block">
                Primary Savings • {account.currency}
              </span>
            </div>
          </div>

          <Badge variant={statusVariantMap[account.status]} dot size="sm">
            {account.status}
          </Badge>
        </div>

        {/* Balance section */}
        <div className="mt-5 space-y-1">
          <span className="text-[11px] font-semibold text-txt-muted uppercase tracking-wider">
            Available Balance
          </span>
          {account.balanceLoading ? (
            <Skeleton width="60%" height={28} />
          ) : (
            <div className="text-2xl font-bold text-txt-primary tracking-tight">
              {/* account.balance is integer paise from the API; formatPaise divides by 100 */}
              {formatPaise(account.balance, account.currency)}
            </div>
          )}
        </div>
      </div>

      {/* Footer details */}
      <div className="mt-6 pt-4 border-t border-border/80 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-txt-muted text-[11px]">
          <Shield className="w-3.5 h-3.5 text-secondary" />
          <span>Opened {formatDate(account.createdAt)}</span>
        </div>

        {onViewDetails && (
          <button
            type="button"
            onClick={() => onViewDetails(account)}
            className="inline-flex items-center gap-1 text-secondary hover:text-primary-light font-medium text-xs transition-colors"
          >
            <Info className="w-3.5 h-3.5" />
            <span>Details</span>
          </button>
        )}
      </div>
    </Card>
  );
};
