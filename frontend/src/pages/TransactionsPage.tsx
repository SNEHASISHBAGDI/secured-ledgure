import React from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { TransactionHistoryView } from '../components/transactions/TransactionHistoryView';

export const TransactionsPage: React.FC = () => {
  return (
    <AppLayout
      title="Transaction Ledger"
      subtitle="Complete double-entry transaction record and settlement audit"
    >
      <TransactionHistoryView />
    </AppLayout>
  );
};
