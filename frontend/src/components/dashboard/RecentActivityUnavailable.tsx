import React, { useEffect, useState } from 'react';
import { History, Sparkles, ArrowRight, ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../common/Card';
import { Skeleton } from '../common/Skeleton';
import { getTransactionsApi } from '../../api/transactions.api';
import { Transaction } from '../../types/transaction';
import { formatPaise, maskAccountId } from '../../utils/currency';
import { formatDateTime } from '../../utils/date';

export const RecentActivityUnavailable: React.FC = () => {
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    getTransactionsApi({ limit: 5 })
      .then((res) => {
        if (isMounted) {
          setRecentTransactions(res.transactions || []);
        }
      })
      .catch(() => {
        // Silently handle in dashboard overview
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <Card className="p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
          <div>
            <h3 className="text-base font-semibold text-txt-primary flex items-center gap-2">
              <History className="w-4 h-4 text-secondary" />
              <span>Recent Activity & Ledger Journal</span>
            </h3>
            <p className="text-xs text-txt-secondary mt-0.5">
              Latest immutable double-entry journal records
            </p>
          </div>
          <Link
            to="/transactions"
            className="text-xs font-semibold text-secondary hover:text-primary-light flex items-center gap-1 transition-colors"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3 py-2">
            <Skeleton height={44} />
            <Skeleton height={44} />
            <Skeleton height={44} />
          </div>
        ) : recentTransactions.length === 0 ? (
          <div className="py-8 px-4 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-surface-elevated border border-border flex items-center justify-center text-txt-muted mb-3 shadow-card">
              <History className="w-6 h-6 text-secondary/70" />
            </div>
            <h4 className="text-sm font-semibold text-txt-primary mb-1">
              No Recent Ledger Activity
            </h4>
            <p className="text-xs text-txt-muted leading-relaxed">
              When you transfer funds between accounts, recorded debits and credits will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {recentTransactions.map((tx) => {
              const isCredit = tx.direction === 'CREDIT';
              return (
                <div key={tx._id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${
                      isCredit
                        ? 'bg-status-success/15 text-status-success'
                        : tx.direction === 'DEBIT'
                        ? 'bg-status-error/15 text-status-error'
                        : 'bg-primary/15 text-secondary'
                    }`}>
                      {isCredit ? (
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                      ) : tx.direction === 'DEBIT' ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-txt-primary">
                        {tx.direction === 'CREDIT' ? 'Received from' : 'Transfer to'}{' '}
                        <span className="font-mono text-txt-secondary">
                          {tx.counterparty ? maskAccountId(tx.counterparty) : 'Account'}
                        </span>
                      </p>
                      <p className="text-[11px] text-txt-muted">{formatDateTime(tx.createdAt)}</p>
                    </div>
                  </div>

                  <span className={`font-semibold ${isCredit ? 'text-status-success' : 'text-txt-primary'}`}>
                    {/* tx.amount is integer paise from the API */}
                    {isCredit ? '+' : '-'}{formatPaise(tx.amount, 'INR')}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
};

export const SpendingOverviewUnavailable: React.FC = () => {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between pb-4 border-b border-border mb-6">
        <div>
          <h3 className="text-base font-semibold text-txt-primary flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-secondary" />
            <span>Spending Analytics & Insights</span>
          </h3>
          <p className="text-xs text-txt-secondary mt-0.5">
            Breakdown of debits, credits, and monthly cash flow
          </p>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-surface-elevated text-txt-muted border border-border">
          Roadmap
        </span>
      </div>

      <div className="py-8 px-4 flex flex-col items-center justify-center text-center max-w-md mx-auto">
        <div className="grid grid-cols-3 gap-2 w-full max-w-xs mb-4 opacity-30">
          <div className="h-16 bg-surface-elevated rounded-lg animate-pulse" />
          <div className="h-24 bg-primary/30 rounded-lg animate-pulse" />
          <div className="h-12 bg-surface-elevated rounded-lg animate-pulse" />
        </div>

        <h4 className="text-sm font-semibold text-txt-primary mb-1">
          Analytics Pipeline in Preparation
        </h4>

        <p className="text-xs text-txt-muted leading-relaxed">
          Aggregated spending charts, expense categorization, and cash flow projections are currently in development for a future update.
        </p>
      </div>
    </Card>
  );
};
