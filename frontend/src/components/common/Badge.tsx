import React from 'react';

export type BadgeVariant =
  | 'active'
  | 'frozen'
  | 'closed'
  | 'pending'
  | 'completed'
  | 'failed'
  | 'neutral'
  | 'primary'
  | 'warning';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
}) => {
  const variantStyles: Record<BadgeVariant, { bg: string; text: string; dotColor: string }> = {
    active: {
      bg: 'bg-status-success/15 border-status-success/30',
      text: 'text-status-success',
      dotColor: 'bg-status-success',
    },
    completed: {
      bg: 'bg-status-success/15 border-status-success/30',
      text: 'text-status-success',
      dotColor: 'bg-status-success',
    },
    frozen: {
      bg: 'bg-status-warning/15 border-status-warning/30',
      text: 'text-status-warning',
      dotColor: 'bg-status-warning',
    },
    warning: {
      bg: 'bg-status-warning/15 border-status-warning/30',
      text: 'text-status-warning',
      dotColor: 'bg-status-warning',
    },
    closed: {
      bg: 'bg-status-error/15 border-status-error/30',
      text: 'text-status-error',
      dotColor: 'bg-status-error',
    },
    failed: {
      bg: 'bg-status-error/15 border-status-error/30',
      text: 'text-status-error',
      dotColor: 'bg-status-error',
    },
    pending: {
      bg: 'bg-status-info/15 border-status-info/30',
      text: 'text-status-info',
      dotColor: 'bg-status-info',
    },
    primary: {
      bg: 'bg-primary/20 border-primary/40',
      text: 'text-secondary',
      dotColor: 'bg-secondary',
    },
    neutral: {
      bg: 'bg-surface-elevated border-border',
      text: 'text-txt-secondary',
      dotColor: 'bg-txt-muted',
    },
  };

  const style = variantStyles[variant];
  const sizeClass = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium border rounded-full select-none ${style.bg} ${style.text} ${sizeClass} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${style.dotColor} animate-pulse`} />}
      {children}
    </span>
  );
};
