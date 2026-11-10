import React, { InputHTMLAttributes, forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightAction?: React.ReactNode;
  allowPasswordToggle?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightAction,
      allowPasswordToggle = false,
      type = 'text',
      id,
      className = '',
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const isPassword = type === 'password';
    const computedType = isPassword && allowPasswordToggle ? (showPassword ? 'text' : 'password') : type;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-txt-secondary tracking-wide uppercase">
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-txt-muted">
              {leftIcon}
            </div>
          )}

          <input
            id={inputId}
            ref={ref}
            type={computedType}
            className={`w-full bg-surface-elevated/70 border text-txt-primary rounded-input px-3.5 py-2.5 text-sm transition-all duration-150 placeholder:text-txt-muted/60 focus:outline-none focus:ring-2 focus:bg-surface-elevated ${
              leftIcon ? 'pl-10' : ''
            } ${isPassword && allowPasswordToggle ? 'pr-11' : rightAction ? 'pr-10' : ''} ${
              error
                ? 'border-status-error/80 focus:border-status-error focus:ring-status-error/20'
                : 'border-border focus:border-primary focus:ring-primary/20 hover:border-border/80'
            } ${className}`}
            {...props}
          />

          {isPassword && allowPasswordToggle && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 p-1 rounded-md text-txt-muted hover:text-txt-primary focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}

          {!isPassword && rightAction && (
            <div className="absolute right-3 flex items-center">{rightAction}</div>
          )}
        </div>

        {error ? (
          <p className="text-xs text-status-error font-medium flex items-center gap-1 animate-fadeIn">
            {error}
          </p>
        ) : hint ? (
          <p className="text-xs text-txt-muted">{hint}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
