import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CreditCard,
  Send,
  ReceiptText,
  Users,
  UserCheck,
  Settings,
  LogOut,
  X,
  ShieldCheck,
} from 'lucide-react';
import { Logo } from '../common/Logo';
import { useAuth } from '../../auth/AuthProvider';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  isComingSoon?: boolean;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Accounts', path: '/accounts', icon: CreditCard },
  { name: 'Transfer Money', path: '/transfer', icon: Send },
  { name: 'Transactions', path: '/transactions', icon: ReceiptText },
  { name: 'Beneficiaries', path: '/beneficiaries', icon: Users, isComingSoon: true },
  { name: 'Profile', path: '/profile', icon: UserCheck },
  { name: 'Settings', path: '/settings', icon: Settings, isComingSoon: true },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background-app/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 w-64 bg-background-sidebar border-r border-border flex flex-col justify-between transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Header */}
        <div>
          <div className="h-16 px-5 border-b border-border flex items-center justify-between">
            <Logo size="md" linkTo="/dashboard" />
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-txt-muted hover:text-txt-primary hover:bg-surface-elevated"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="px-3 py-4 space-y-1">
            <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider uppercase text-txt-muted">
              Main Menu
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => onClose()}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3.5 py-2.5 rounded-input text-sm font-medium transition-all group ${
                      isActive
                        ? 'bg-primary text-white shadow-glow-primary'
                        : 'text-txt-secondary hover:text-txt-primary hover:bg-surface-elevated'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-3">
                        <Icon
                          className={`w-4 h-4 transition-colors ${
                            isActive ? 'text-white' : 'text-txt-muted group-hover:text-txt-primary'
                          }`}
                        />
                        <span>{item.name}</span>
                      </div>
                      {item.isComingSoon && (
                        <span
                          className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-surface-elevated text-txt-muted border border-border'
                          }`}
                        >
                          Soon
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* Security badge and User Footer */}
        <div className="p-3 border-t border-border space-y-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-card border border-border/60">
            <ShieldCheck className="w-4 h-4 text-secondary shrink-0" />
            <div className="text-[11px] text-txt-muted">
              <span className="text-txt-primary font-medium">Internal Ledger</span> Demo Mode
            </div>
          </div>

          <div className="flex items-center justify-between p-2 rounded-xl bg-surface-elevated border border-border/80">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-xs font-bold text-secondary shrink-0">
                {getInitials(user?.name)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-txt-primary truncate">
                  {user?.name || 'Verified User'}
                </p>
                <p className="text-[11px] text-txt-muted truncate">
                  {user?.email || 'user@example.com'}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Logout"
              className="p-1.5 rounded-lg text-txt-muted hover:text-status-error hover:bg-status-error/10 transition-colors shrink-0"
              aria-label="Logout from account"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
