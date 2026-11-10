import React from 'react';
import { CreditCard, Send, History, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../common/Card';

export const QuickActions: React.FC = () => {
  const actions = [
    {
      title: 'View Accounts',
      desc: 'Inspect balances, active cards and ledger status',
      icon: CreditCard,
      link: '/accounts',
      color: 'text-secondary',
      bg: 'bg-primary/10',
    },
    {
      title: 'Transfer Money',
      desc: 'Send funds securely between ledger accounts',
      icon: Send,
      link: '/transfer',
      color: 'text-status-success',
      bg: 'bg-status-success/10',
    },
    {
      title: 'Transaction History',
      desc: 'Inspect audit trail and historical ledger entries',
      icon: History,
      link: '/transactions',
      color: 'text-status-info',
      bg: 'bg-status-info/10',
    },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-txt-secondary uppercase tracking-wider">
        Quick Actions
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <Link key={act.title} to={act.link} className="block group">
              <Card
                hoverEffect
                className="p-4 transition-all duration-200 border-border group-hover:border-primary/40 flex items-center justify-between"
              >
                <div className="flex items-center gap-3.5">
                  <div className={`p-2.5 rounded-xl ${act.bg} ${act.color} shrink-0`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-txt-primary group-hover:text-secondary transition-colors">
                      {act.title}
                    </h4>
                    <p className="text-xs text-txt-muted">{act.desc}</p>
                  </div>
                </div>

                <ArrowRight className="w-4 h-4 text-txt-muted group-hover:text-txt-primary group-hover:translate-x-1 transition-all shrink-0 ml-2" />
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
