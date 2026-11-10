import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Account } from '../../types/account';
import { Transaction } from '../../types/transaction';
import { createTransactionApi } from '../../api/transactions.api';
import { formatPaise, parseMajorToPaise, maskAccountId } from '../../utils/currency';
import { generateIdempotencyKey } from '../../utils/validation';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Badge } from '../common/Badge';
import {
  Send,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  ReceiptText,
  Info,
} from 'lucide-react';

interface TransferFormProps {
  accounts: Account[];
  onSuccess?: () => void;
}

export const TransferForm: React.FC<TransferFormProps> = ({ accounts, onSuccess }) => {
  const [fromAccountId, setFromAccountId] = useState<string>(accounts[0]?._id || '');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');

  // Generate one key per intended transfer and preserve it across retries.
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateIdempotencyKey());

  const [step, setStep] = useState<'INPUT' | 'REVIEW' | 'SUCCESS'>('INPUT');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedTx, setCompletedTx] = useState<Transaction | null>(null);

  // Derive selected account; API balance is always integer paise.
  const selectedAccount = accounts.find((a) => a._id === fromAccountId) || accounts[0];
  const availableBalancePaise = selectedAccount?.balance ?? 0;

  // Exact string-to-paise parsing without floating-point arithmetic.
  const amountValidation = parseMajorToPaise(amount);
  const typedAmountPaise = amountValidation.paise ?? 0;
  const isValidAmount = amountValidation.valid && amountValidation.paise !== null;
  const isOverBalance = isValidAmount && typedAmountPaise > availableBalancePaise;
  const isValidToAccount = /^[0-9a-fA-F]{24}$/.test(toAccountId.trim());
  const isSameAccount = Boolean(fromAccountId && toAccountId.trim() === fromAccountId);

  const canProceedToReview = Boolean(
    fromAccountId &&
      isValidToAccount &&
      isValidAmount &&
      !isOverBalance &&
      !isSameAccount
  );

  const accountOptions = accounts.map((acc) => ({
    value: acc._id,
    label: `${maskAccountId(acc._id)} — Balance: ${formatPaise(acc.balance, acc.currency)} (${acc.currency})`,
  }));

  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (canProceedToReview) {
      setErrorMessage(null);
      setStep('REVIEW');
    }
  };

  // Reuses idempotencyKey automatically when retrying after transient/network errors.
  const handleConfirmTransfer = async () => {
    if (!amountValidation.valid || amountValidation.paise === null) {
      setErrorMessage(amountValidation.error || 'Invalid transfer amount');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await createTransactionApi({
        fromAccount: fromAccountId,
        toAccount: toAccountId.trim(),
        amount: amountValidation.paise,
        idempotencyKey,
      });

      setCompletedTx(response.transaction);
      setStep('SUCCESS');
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Transfer could not be completed. Please review and retry.';
      setErrorMessage(msg);
      // Preserve idempotencyKey so retrying uses the exact same key
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForNewTransfer = () => {
    setAmount('');
    setToAccountId('');
    setErrorMessage(null);
    setCompletedTx(null);
    setIdempotencyKey(generateIdempotencyKey());
    setStep('INPUT');
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="p-4 rounded-xl bg-surface-elevated/70 border border-border flex items-start gap-3 text-xs text-txt-secondary">
        <Info className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-txt-primary">Demonstration Ledger System</p>
          <p className="text-txt-muted leading-relaxed">
            All transfers update internal double-entry ledger accounts only. This application does not connect to real-world banking rails or move real money.
          </p>
        </div>
      </div>

      <Card className="p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-secondary border border-primary/20">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-txt-primary">Initiate Fund Transfer</h2>
              <p className="text-xs text-txt-secondary">
                Atomic double-entry transfer between ledger accounts
              </p>
            </div>
          </div>
          <Badge variant="primary" size="sm">
            Double-Entry
          </Badge>
        </div>

        {accounts.length === 0 ? (
          <div className="p-8 text-center text-txt-muted text-sm bg-surface-elevated rounded-xl">
            No active accounts available. Please open an account first before transferring.
          </div>
        ) : step === 'SUCCESS' && completedTx ? (
          /* SUCCESS STATE */
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 rounded-xl bg-status-success/10 border border-status-success/30 flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-status-success shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold text-status-success">Transfer Completed Successfully</h3>
                <p className="text-xs text-txt-secondary mt-1">
                  The ledger entries have been immutably recorded in the double-entry journal.
                </p>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-surface-elevated border border-border space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-border/60">
                <span className="text-txt-muted">Transaction ID:</span>
                <span className="font-mono text-txt-primary font-medium select-all">
                  {completedTx._id}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/60">
                <span className="text-txt-muted">Source Account:</span>
                <span className="font-mono text-txt-primary">
                  {maskAccountId(completedTx.fromAccount)} ({selectedAccount?.currency || 'INR'})
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/60">
                <span className="text-txt-muted">Recipient Account:</span>
                <span className="font-mono text-txt-primary">
                  {completedTx.toAccount}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/60">
                <span className="text-txt-muted">Amount Transferred:</span>
                <span className="font-bold text-base text-status-success">
                  {formatPaise(completedTx.amount, selectedAccount?.currency || 'INR')}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/60">
                <span className="text-txt-muted">Ledger Settlement Status:</span>
                <Badge variant="completed" size="sm">
                  {completedTx.status}
                </Badge>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-txt-muted">Idempotency Key:</span>
                <span className="font-mono text-txt-muted text-[11px] truncate max-w-[200px]">
                  {completedTx.idempotencyKey || idempotencyKey}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="primary"
                fullWidth
                onClick={handleResetForNewTransfer}
                leftIcon={<RotateCcw className="w-4 h-4" />}
              >
                Make Another Transfer
              </Button>
              <Link to="/transactions" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  fullWidth
                  leftIcon={<ReceiptText className="w-4 h-4" />}
                >
                  View Transactions
                </Button>
              </Link>
            </div>
          </div>
        ) : step === 'REVIEW' ? (
          /* REVIEW CONFIRMATION STEP */
          <div className="space-y-6 animate-in fade-in duration-150">
            {errorMessage && (
              <div className="p-4 rounded-xl bg-status-error/15 border border-status-error/30 flex items-start gap-2.5 text-xs text-status-error">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Transfer Failed</p>
                  <p className="mt-0.5 text-status-error/90">{errorMessage}</p>
                </div>
              </div>
            )}

            <div className="p-5 rounded-xl bg-surface-elevated border border-border space-y-3.5 text-xs">
              <div className="text-xs font-semibold uppercase tracking-wider text-txt-secondary pb-1 border-b border-border/60">
                Transfer Summary Review
              </div>

              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-txt-muted">From Account:</span>
                <span className="font-medium text-txt-primary">
                  {maskAccountId(fromAccountId)} (Available: {formatPaise(availableBalancePaise, selectedAccount?.currency || 'INR')})
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-txt-muted">Recipient Account ID:</span>
                <span className="font-mono text-txt-primary font-medium">
                  {toAccountId.trim()}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-txt-muted">Transfer Amount:</span>
                <span className="font-bold text-sm text-txt-primary">
                  {formatPaise(typedAmountPaise, selectedAccount?.currency || 'INR')}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-txt-muted">Internal Transfer Fee:</span>
                <span className="font-medium text-txt-secondary">None (Internal Ledger)</span>
              </div>

              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-txt-muted">Remaining Balance After:</span>
                <span className="font-medium text-txt-secondary">
                  {formatPaise(availableBalancePaise - typedAmountPaise, selectedAccount?.currency || 'INR')}
                </span>
              </div>

              <div className="flex justify-between py-1 items-center">
                <span className="text-txt-muted">Audit Idempotency Key:</span>
                <span className="font-mono text-txt-muted text-[11px] truncate max-w-[200px]" title={idempotencyKey}>
                  {idempotencyKey}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setStep('INPUT')}
                disabled={isSubmitting}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
                className="sm:w-1/3"
              >
                Back to Edit
              </Button>
              <Button
                variant="primary"
                fullWidth
                isLoading={isSubmitting}
                onClick={handleConfirmTransfer}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {errorMessage ? 'Retry Transfer' : 'Confirm & Submit Transfer'}
              </Button>
            </div>
          </div>
        ) : (
          /* FORM INPUT STEP */
          <form onSubmit={handleProceedToReview} className="space-y-5">
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-status-error/15 border border-status-error/30 flex items-start gap-2 text-xs text-status-error">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <Select
              label="Source Account (Debit)"
              value={fromAccountId}
              onChange={(e) => setFromAccountId(e.target.value)}
              options={accountOptions}
              hint={
                selectedAccount
                  ? `Available for transfer: ${formatPaise(
                      availableBalancePaise,
                      selectedAccount.currency
                    )}`
                  : undefined
              }
            />

            <Input
              label="Recipient Account ID (Credit)"
              placeholder="e.g. 65f2a1b94e1d4b0012345678"
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              hint="Enter the recipient's 24-character hexadecimal Account ID"
              error={
                isSameAccount
                  ? 'Source and recipient accounts cannot be the same'
                  : toAccountId && !isValidToAccount
                  ? 'Account ID must be a valid 24-character hexadecimal identifier'
                  : undefined
              }
            />

            <Input
              label={`Transfer Amount (${selectedAccount?.currency || 'INR'})`}
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              leftIcon={<span className="text-xs font-semibold text-txt-secondary">₹</span>}
              error={
                isOverBalance
                  ? `Insufficient balance (${formatPaise(
                      availableBalancePaise,
                      selectedAccount?.currency || 'INR'
                    )} available)`
                  : amount.trim() && !isValidAmount
                  ? amountValidation.error || 'Please enter a valid positive amount (up to 2 decimal places)'
                  : undefined
              }
            />

            <div className="p-3.5 rounded-xl bg-surface-elevated/80 border border-border flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-txt-secondary">
                <HelpCircle className="w-4 h-4 text-txt-muted shrink-0" />
                <span>Idempotency Key (Generated):</span>
              </div>
              <span className="font-mono text-txt-muted text-[11px] truncate max-w-[200px]" title={idempotencyKey}>
                {idempotencyKey}
              </span>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                fullWidth
                disabled={!canProceedToReview}
                variant="primary"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Review Transfer Details
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
};
