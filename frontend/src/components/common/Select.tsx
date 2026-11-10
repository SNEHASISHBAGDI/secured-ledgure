import { SelectHTMLAttributes, forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, id, className = '', ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-semibold text-txt-secondary tracking-wide uppercase">
            {label}
          </label>
        )}

        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            className={`w-full appearance-none bg-surface-elevated/70 border text-txt-primary rounded-input px-3.5 py-2.5 pr-10 text-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:bg-surface-elevated ${
              error
                ? 'border-status-error/80 focus:border-status-error focus:ring-status-error/20'
                : 'border-border focus:border-primary focus:ring-primary/20 hover:border-border/80'
            } ${className}`}
            {...props}
          >
            {options.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className="bg-surface-elevated text-txt-primary py-1"
              >
                {opt.label}
              </option>
            ))}
          </select>

          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-txt-muted">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>

        {error ? (
          <p className="text-xs text-status-error font-medium">{error}</p>
        ) : hint ? (
          <p className="text-xs text-txt-muted">{hint}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
