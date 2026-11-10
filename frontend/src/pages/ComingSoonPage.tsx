import React from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Link } from 'react-router-dom';
import { Construction, ArrowLeft, ShieldCheck, LucideIcon } from 'lucide-react';

interface ComingSoonPageProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  description: string;
  expectedFeatureList: string[];
}

export const ComingSoonPage: React.FC<ComingSoonPageProps> = ({
  title,
  subtitle,
  icon: Icon,
  description,
  expectedFeatureList,
}) => {
  return (
    <AppLayout title={title} subtitle={subtitle}>
      <div className="max-w-2xl mx-auto py-8">
        <Card elevated className="p-8 sm:p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-elevated border border-border flex items-center justify-center text-secondary mb-6 shadow-card">
            <Icon className="w-8 h-8 text-secondary" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-status-info/10 border border-status-info/30 text-xs font-semibold text-status-info mb-3">
            <Construction className="w-3.5 h-3.5" />
            <span>Under Active Development</span>
          </div>

          <h2 className="text-2xl font-bold text-txt-primary mb-2">{title}</h2>
          <p className="text-xs sm:text-sm text-txt-secondary max-w-md leading-relaxed mb-6">
            {description}
          </p>

          <div className="w-full p-4 rounded-xl bg-surface-elevated border border-border/80 text-left space-y-2 mb-8">
            <span className="text-[11px] font-semibold text-txt-muted uppercase tracking-wider block">
              Planned Capabilities
            </span>
            <ul className="space-y-2 text-xs text-txt-secondary">
              {expectedFeatureList.map((item, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-status-success shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <Link to="/dashboard">
            <Button variant="secondary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Return to Dashboard
            </Button>
          </Link>
        </Card>
      </div>
    </AppLayout>
  );
};
