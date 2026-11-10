import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { createAccountApi } from '../../api/accounts.api';
import { Account } from '../../types/account';
import { CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';

interface CreateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountCreated: (newAccount: Account) => void;
}

export const CreateAccountModal: React.FC<CreateAccountModalProps> = ({
  isOpen,
  onClose,
  onAccountCreated,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdAccount, setCreatedAccount] = useState<Account | null>(null);

  const handleCreate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await createAccountApi();
      setCreatedAccount(response.account);
      onAccountCreated(response.account);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create new account. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setCreatedAccount(null);
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={createdAccount ? 'Account Successfully Created' : 'Open New Ledger Account'}
      description={
        createdAccount
          ? 'Your new ledger account is active and ready for transfers.'
          : 'Provision a new verified ledger account with instant activation.'
      }
    >
      {createdAccount ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-status-success/10 border border-status-success/30 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-status-success shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm">
              <p className="font-semibold text-status-success">Account Provisioned</p>
              <p className="text-txt-secondary mt-1">
                Your new account has been registered with the internal ledger.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-surface-elevated border border-border space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-border/60">
              <span className="text-txt-muted">Account ID:</span>
              <span className="font-mono font-medium text-txt-primary select-all">
                {createdAccount._id}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/60">
              <span className="text-txt-muted">Currency:</span>
              <span className="font-medium text-txt-primary">{createdAccount.currency}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/60">
              <span className="text-txt-muted">Initial Balance:</span>
              <span className="font-medium text-status-success">₹0.00</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-txt-muted">Status:</span>
              <span className="font-semibold text-status-success">{createdAccount.status}</span>
            </div>
          </div>

          <Button fullWidth onClick={handleClose}>
            Done
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="p-3.5 rounded-xl bg-surface-elevated border border-border flex items-start gap-3 text-xs text-txt-secondary">
            <ShieldCheck className="w-5 h-5 text-secondary shrink-0" />
            <div>
              <p className="font-medium text-txt-primary">Direct Ledger Provisioning</p>
              <p className="text-txt-muted mt-0.5">
                Each account maintains its own verified double-entry ledger within the Secure
                Ledger database. Default currency is Indian Rupee (INR).
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-status-error/15 border border-status-error/30 flex items-center gap-2 text-xs text-status-error">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="ghost" fullWidth onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              isLoading={isLoading}
              onClick={handleCreate}
            >
              Confirm & Open Account
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
