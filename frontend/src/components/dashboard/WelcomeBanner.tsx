import React from 'react';
import { ShieldCheck, Calendar } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';

export const WelcomeBanner: React.FC = () => {
  const { user } = useAuth();

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-card bg-gradient-to-r from-surface-card via-surface-card to-surface-elevated border border-border shadow-card">
      <div className="space-y-1">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/30 text-xs font-semibold text-secondary">
          <ShieldCheck className="w-3.5 h-3.5 text-status-success" />
          <span>Authenticated Ledger Session</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-txt-primary tracking-tight">
          Welcome back, <span className="text-secondary">{user?.name || 'Customer'}</span>.
        </h2>
        <p className="text-xs sm:text-sm text-txt-secondary">
          Here is the current overview of your internal ledger accounts and derived balances.
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs text-txt-muted bg-surface-elevated/80 border border-border px-3.5 py-2 rounded-lg self-start md:self-auto">
        <Calendar className="w-4 h-4 text-txt-secondary" />
        <span>{formattedDate}</span>
      </div>
    </div>
  );
};
