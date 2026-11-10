import React from 'react';
import { Menu, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';

interface TopNavbarProps {
  title: string;
  subtitle?: string;
  onOpenMobileMenu: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  title,
  subtitle,
  onOpenMobileMenu,
}) => {
  const { user } = useAuth();

  return (
    <header className="h-16 px-4 sm:px-6 bg-background-app/90 backdrop-blur-md border-b border-border flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg text-txt-secondary hover:text-txt-primary hover:bg-surface-elevated transition-colors"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-base sm:text-lg font-bold text-txt-primary leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] text-txt-secondary hidden sm:block">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* System Ledger Status indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-elevated border border-border text-xs">
          <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
          <span className="text-txt-secondary font-medium">Ledger Engine:</span>
          <span className="text-txt-primary font-semibold">Active</span>
        </div>

        {/* User preview */}
        <div className="flex items-center gap-2.5 pl-2 sm:border-l sm:border-border">
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center text-xs font-bold text-secondary">
            {user?.name ? user.name[0].toUpperCase() : 'U'}
          </div>
          <div className="hidden md:block text-left">
            <p className="text-xs font-semibold text-txt-primary leading-tight">
              {user?.name}
            </p>
            <div className="flex items-center gap-1 text-[10px] text-txt-muted">
              <ShieldCheck className="w-3 h-3 text-status-success" />
              <span>Verified Account</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
