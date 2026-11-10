import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export type NoticeVariant = 'info' | 'warning' | 'error' | 'success';

interface NoticeBannerProps {
  variant?: NoticeVariant;
  title?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export const NoticeBanner: React.FC<NoticeBannerProps> = ({
  variant = 'info',
  title,
  children,
  className = '',
  action,
}) => {
  const variantConfig = {
    info: {
      bg: 'bg-primary/10 border-primary/30',
      text: 'text-txt-primary',
      subtext: 'text-txt-secondary',
      icon: <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />,
    },
    warning: {
      bg: 'bg-status-warning/10 border-status-warning/30',
      text: 'text-status-warning',
      subtext: 'text-txt-secondary',
      icon: <AlertTriangle className="w-5 h-5 text-status-warning shrink-0 mt-0.5" />,
    },
    error: {
      bg: 'bg-status-error/10 border-status-error/30',
      text: 'text-status-error',
      subtext: 'text-txt-secondary',
      icon: <AlertCircle className="w-5 h-5 text-status-error shrink-0 mt-0.5" />,
    },
    success: {
      bg: 'bg-status-success/10 border-status-success/30',
      text: 'text-status-success',
      subtext: 'text-txt-secondary',
      icon: <CheckCircle2 className="w-5 h-5 text-status-success shrink-0 mt-0.5" />,
    },
  };

  const config = variantConfig[variant];

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-card border ${config.bg} ${className}`}
      role="alert"
    >
      {config.icon}
      <div className="flex-1 text-xs sm:text-sm leading-relaxed">
        {title && <p className={`font-semibold mb-0.5 ${config.text}`}>{title}</p>}
        <div className={config.subtext}>{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};
