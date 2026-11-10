import React from 'react';
import { Shield } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  linkTo?: string;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showSubtitle = false,
  linkTo = '/',
  className = '',
}) => {
  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const textSizes = {
    sm: 'text-base font-semibold',
    md: 'text-lg font-bold',
    lg: 'text-2xl font-bold',
  };

  const content = (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="flex items-center justify-center p-2 rounded-xl bg-gradient-to-br from-primary to-primary-light shadow-glow-primary text-white">
        <Shield className={iconSizes[size]} strokeWidth={2.2} />
      </div>
      <div className="flex flex-col">
        <span className={`tracking-tight text-txt-primary font-sans ${textSizes[size]}`}>
          Secure<span className="text-secondary ml-1 font-extrabold">Ledger</span>
        </span>
        {showSubtitle && (
          <span className="text-[10px] tracking-widest uppercase text-txt-muted font-medium">
            Double-Entry Digital Ledger
          </span>
        )}
      </div>
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className="inline-flex focus:outline-none focus:ring-2 focus:ring-primary rounded-lg">
        {content}
      </Link>
    );
  }

  return content;
};
