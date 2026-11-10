import React, { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  className = '',
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-input transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background-app disabled:opacity-50 disabled:cursor-not-allowed select-none';

  const variantStyles: Record<ButtonVariant, string> = {
    primary:
      'bg-primary hover:bg-primary-hover active:bg-primary-active text-white shadow-glow-primary focus:ring-primary',
    secondary:
      'bg-surface-elevated hover:bg-surface-hover text-txt-primary border border-border focus:ring-secondary',
    outline:
      'bg-transparent hover:bg-surface-elevated text-txt-primary border border-border hover:border-txt-muted focus:ring-primary',
    ghost:
      'bg-transparent hover:bg-surface-card text-txt-secondary hover:text-txt-primary focus:ring-primary',
    danger:
      'bg-status-error/15 hover:bg-status-error/25 text-status-error border border-status-error/30 focus:ring-status-error',
  };

  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 h-8',
    md: 'text-sm px-4 py-2.5 gap-2 h-10',
    lg: 'text-base px-6 py-3.5 gap-2.5 h-12',
  };

  const widthStyle = fullWidth ? 'w-full' : '';

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyle} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </button>
  );
};
