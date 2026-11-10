import React from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { Card } from '../components/common/Card';
import { NoticeBanner } from '../components/common/NoticeBanner';
import { useAuth } from '../auth/AuthProvider';
import { UserCheck, ShieldCheck, Mail, Key, ShieldAlert } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();

  return (
    <AppLayout
      title="User Profile"
      subtitle="Verified customer credentials and authentication security details"
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <NoticeBanner
          variant="info"
          title="Verified Profile Information"
        >
          This profile displays only verified credentials provided during authentication. Profile
          updates, avatar uploads, and password modification APIs have not yet been deployed to the
          backend service and remain read-only.
        </NoticeBanner>

        <Card elevated className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-4 pb-6 border-b border-border">
            <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary/50 flex items-center justify-center text-xl font-bold text-secondary">
              {user?.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-txt-primary">{user?.name || 'Customer'}</h2>
              <div className="flex items-center gap-1.5 text-xs text-status-success font-medium mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified Ledger User</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-surface-elevated border border-border/80 space-y-3 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-border/60">
                <span className="text-txt-muted flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-secondary" />
                  <span>Full Legal Name</span>
                </span>
                <span className="font-semibold text-txt-primary">{user?.name}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-border/60">
                <span className="text-txt-muted flex items-center gap-2">
                  <Mail className="w-4 h-4 text-secondary" />
                  <span>Registered Email</span>
                </span>
                <span className="font-medium text-txt-primary">{user?.email}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-border/60">
                <span className="text-txt-muted flex items-center gap-2">
                  <Key className="w-4 h-4 text-secondary" />
                  <span>Unique User ID</span>
                </span>
                <span className="font-mono text-txt-secondary text-[11px] select-all">
                  {user?._id}
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-txt-muted flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-secondary" />
                  <span>Authentication Token</span>
                </span>
                <span className="text-status-success font-medium">Active (JWT Cookie Session)</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
};
