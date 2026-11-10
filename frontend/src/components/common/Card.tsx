import React, { HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  elevated = false,
  hoverEffect = false,
  className = '',
  ...props
}) => {
  const bgStyle = elevated ? 'bg-surface-elevated' : 'bg-surface-card';
  const hoverStyle = hoverEffect
    ? 'hover:border-primary/50 hover:shadow-elevated transition-all duration-200'
    : '';

  return (
    <div
      className={`border border-border rounded-card p-5 sm:p-6 shadow-card ${bgStyle} ${hoverStyle} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
