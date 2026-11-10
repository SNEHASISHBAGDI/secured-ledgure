import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Account } from '../../types/account';
import { formatPaise } from '../../utils/currency';
import { formatDateTime } from '../../utils/date';
import { Copy, Check, ShieldCheck } from 'lucide-react';

interface AccountDetailModalProps {
  account: Account | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AccountDetailModal: React.FC<AccountDetailModalProps> = ({
  account,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!account) return null;

  const handleCopyId = () => {
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Account Information & Ledger Details"
      description="Verified ledger properties associated with this banking account."
    >
      <div className="space-y-4">
        {/* Balance Card Header */}
        <div className="p-4 rounded-xl bg-surface-elevated border border-border flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-txt-muted uppercase tracking-wider">
              Current Balance
            </span>
            <div className="text-2xl font-bold text-txt-primary">
              {/* account.balance is integer paise from the API */}
              {formatPaise(account.balance, account.currency)}
            </div>
          </div>
          <Badge variant={statusVariantMap[account.status]} dot>
            {account.status}
          </Badge>
        </div>

        {/* Detailed Fields */}
        <div className="p-4 rounded-xl bg-surface-card border border-border space-y-3 text-xs">
          <div className="flex items-center justify-between py-1 border-b border-border/60">
            <span className="text-txt-muted">Full Account ID</span>
            <div className="flex items-center gap-1.5 font-mono text-txt-primary">
              <span>{account._id}</span>
              <button
                type="button"
                onClick={handleCopyId}
                className="p-1 rounded text-txt-muted hover:text-txt-primary hover:bg-surface-elevated"
                title="Copy Account ID"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-status-success" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-border/60">
            <span className="text-txt-muted">Account Holder ID</span>
            <span className="font-mono text-txt-secondary">{account.user}</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-border/60">
            <span className="text-txt-muted">Denominated Currency</span>
            <span className="font-medium text-txt-primary">{account.currency}</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-border/60">
            <span className="text-txt-muted">Ledger Account Type</span>
            <span className="font-medium text-txt-primary">Primary Savings (Single-User)</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-border/60">
            <span className="text-txt-muted">Created Timestamp</span>
            <span className="text-txt-primary">{formatDateTime(account.createdAt)}</span>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-txt-muted">Last Ledger Sync</span>
            <span className="text-txt-primary">{formatDateTime(account.updatedAt)}</span>
          </div>
        </div>

        {/* Notice on security */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-surface-elevated/80 border border-border text-[11px] text-txt-secondary">
          <ShieldCheck className="w-4 h-4 text-secondary shrink-0" />
          <span>Immutable double-entry ledger backed by atomic database sessions</span>
        </div>

        <Button fullWidth variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
};
