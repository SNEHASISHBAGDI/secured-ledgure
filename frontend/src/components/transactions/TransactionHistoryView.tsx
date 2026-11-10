import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../common/Card';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Skeleton } from '../common/Skeleton';
import { getTransactionsApi } from '../../api/transactions.api';
import { Transaction } from '../../types/transaction';
import { formatPaise, maskAccountId } from '../../utils/currency';
import { formatDateTime } from '../../utils/date';
import {
  Search,
  ReceiptText,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
} from 'lucide-react';

export const TransactionHistoryView: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getTransactionsApi({
        page,
        limit: 10,
        type: selectedType,
        search: searchQuery.trim(),
      });
      setTransactions(data.transactions || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.total || 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load transaction history.');
    } finally {
      setIsLoading(false);
    }
  }, [page, selectedType, searchQuery]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getDirectionBadge = (tx: Transaction) => {
    if (tx.direction === 'CREDIT') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-status-success bg-status-success/10 px-2 py-0.5 rounded-full border border-status-success/20">
          <ArrowDownLeft className="w-3 h-3" />
          CREDIT
        </span>
      );
    }
    if (tx.direction === 'DEBIT') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-status-error bg-status-error/10 px-2 py-0.5 rounded-full border border-status-error/20">
          <ArrowUpRight className="w-3 h-3" />
          DEBIT
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-secondary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
        <ArrowLeftRight className="w-3 h-3" />
        SELF
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters Bar */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Search by full 24-char Transaction/Account ID or reference key..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter buttons */}
            <div className="inline-flex rounded-input bg-surface-elevated p-1 border border-border text-xs">
              {(['ALL', 'CREDIT', 'DEBIT'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setSelectedType(type);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded font-medium transition-colors ${
                    selectedType === type
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-txt-secondary hover:text-txt-primary'
                  }`}
                >
                  {type === 'ALL' ? 'All Transactions' : type}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchTransactions}
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-elevated/70 text-txt-secondary text-xs uppercase tracking-wider border-b border-border">
              <tr>
                <th className="py-3.5 px-4 sm:px-6 font-semibold">Date & Time</th>
                <th className="py-3.5 px-4 sm:px-6 font-semibold">Transaction ID</th>
                <th className="py-3.5 px-4 sm:px-6 font-semibold">Type</th>
                <th className="py-3.5 px-4 sm:px-6 font-semibold">Counterparty</th>
                <th className="py-3.5 px-4 sm:px-6 font-semibold">Status</th>
                <th className="py-3.5 px-4 sm:px-6 font-semibold text-right">Amount (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-4 px-4 sm:px-6"><Skeleton width={130} height={18} /></td>
                    <td className="py-4 px-4 sm:px-6"><Skeleton width={110} height={18} /></td>
                    <td className="py-4 px-4 sm:px-6"><Skeleton width={70} height={18} /></td>
                    <td className="py-4 px-4 sm:px-6"><Skeleton width={90} height={18} /></td>
                    <td className="py-4 px-4 sm:px-6"><Skeleton width={80} height={18} /></td>
                    <td className="py-4 px-4 sm:px-6 text-right"><Skeleton width={80} height={18} className="ml-auto" /></td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={6} className="py-12 px-4 text-center text-xs text-status-error">
                    <p className="font-semibold">{error}</p>
                    <Button size="sm" variant="outline" className="mt-2" onClick={fetchTransactions}>
                      Retry
                    </Button>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 px-4 text-center">
                    <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-surface-elevated border border-border flex items-center justify-center text-txt-muted">
                        <ReceiptText className="w-6 h-6 text-secondary/80" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-base font-semibold text-txt-primary">
                          No Transactions Recorded
                        </h4>
                        <p className="text-xs text-txt-muted leading-relaxed">
                          {searchQuery || selectedType !== 'ALL'
                            ? 'No transactions matched the selected filter or search query.'
                            : 'No transfer transactions have been logged on your accounts yet.'}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const isCredit = tx.direction === 'CREDIT';
                  return (
                    <tr key={tx._id} className="hover:bg-surface-elevated/40 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6 text-xs text-txt-secondary whitespace-nowrap">
                        {formatDateTime(tx.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <span>{tx._id.slice(0, 8)}...</span>
                          <button
                            type="button"
                            onClick={() => handleCopyId(tx._id)}
                            className="p-1 rounded text-txt-muted hover:text-txt-primary hover:bg-surface-elevated"
                            title="Copy full transaction ID"
                          >
                            {copiedId === tx._id ? (
                              <Check className="w-3.5 h-3.5 text-status-success" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                        {getDirectionBadge(tx)}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap text-xs font-mono text-txt-secondary">
                        {tx.counterparty ? maskAccountId(tx.counterparty) : '—'}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                        <Badge
                          variant={tx.status === 'COMPLETED' ? 'completed' : tx.status === 'PENDING' ? 'pending' : 'failed'}
                          size="sm"
                        >
                          {tx.status}
                        </Badge>
                      </td>
                      <td className={`py-3.5 px-4 sm:px-6 whitespace-nowrap font-semibold text-right text-xs ${
                        isCredit ? 'text-status-success' : 'text-txt-primary'
                      }`}>
                        {/* tx.amount is integer paise from the API */}
                        {isCredit ? '+' : '-'}{formatPaise(tx.amount, 'INR')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 bg-surface-elevated/40 border-t border-border flex items-center justify-between text-xs text-txt-muted">
          <span>
            Showing {transactions.length} of {totalCount} transactions
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Previous
            </Button>
            <span className="px-2.5 py-1 bg-surface-elevated rounded border border-border text-txt-primary font-medium">
              Page {page} of {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
