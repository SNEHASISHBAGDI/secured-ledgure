import React from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  CreditCard,
  Lock,
  ArrowRight,
  TrendingUp,
  FileCheck2,
  CheckCircle2,
  Zap,
  Database,
} from 'lucide-react';
import { PublicNavbar } from '../components/layout/PublicNavbar';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { useAuth } from '../auth/AuthProvider';

export const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuth();

  const features = [
    {
      title: 'Account Management',
      description:
        'Instant creation and real-time lifecycle tracking of verified multi-currency ledger accounts.',
      icon: CreditCard,
      color: 'text-secondary',
      bg: 'bg-primary/10',
    },
    {
      title: 'Secure Authentication',
      description:
        'JWT session tokens paired with bcrypt credential hashing and cookie-backed session transport.',
      icon: Lock,
      color: 'text-status-success',
      bg: 'bg-status-success/10',
    },
    {
      title: 'Real-time Derived Balances',
      description:
        'Balance calculation aggregated dynamically from immutable credit and debit ledger entries.',
      icon: TrendingUp,
      color: 'text-status-info',
      bg: 'bg-status-info/10',
    },
    {
      title: 'Idempotent Fund Transfers',
      description:
        'Distributed transfer transactions protected against duplication using unique idempotency keys.',
      icon: Zap,
      color: 'text-status-warning',
      bg: 'bg-status-warning/10',
    },
    {
      title: 'Immutable Transaction Ledger',
      description:
        'Strict double-entry journal entries preventing ledger tampering, alterations, or deletions.',
      icon: Database,
      color: 'text-secondary',
      bg: 'bg-primary/10',
    },
    {
      title: 'Structured Audit Logs',
      description:
        'Clean transaction states tracking PENDING, COMPLETED, FAILED and REVERSED lifecycles.',
      icon: FileCheck2,
      color: 'text-status-success',
      bg: 'bg-status-success/10',
    },
  ];

  return (
    <div className="min-h-screen bg-background-app text-txt-primary flex flex-col">
      <PublicNavbar />

      {/* Hero Section */}
      <section className="relative pt-16 sm:pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full flex flex-col items-center text-center">
        {/* Subtle decorative glow */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-primary/15 rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-elevated border border-border text-xs font-semibold text-secondary mb-6 shadow-sm">
          <Shield className="w-3.5 h-3.5 text-secondary" />
          <span>Double-Entry Digital Banking Architecture</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-txt-primary max-w-4xl leading-[1.1]">
          Bank smarter. <br />
          <span className="bg-gradient-to-r from-primary via-secondary to-primary-light bg-clip-text text-transparent">
            Stay in control.
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-txt-secondary max-w-2xl leading-relaxed">
          Manage your accounts, make secure transfers and keep track of your banking activity with
          Secure Ledger.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link to={isAuthenticated ? '/dashboard' : '/register'} className="w-full sm:w-auto">
            <Button
              size="lg"
              variant="primary"
              fullWidth
              rightIcon={<ArrowRight className="w-5 h-5" />}
            >
              {isAuthenticated ? 'Enter Dashboard' : 'Get Started'}
            </Button>
          </Link>

          <a href="#features" className="w-full sm:w-auto">
            <Button size="lg" variant="secondary" fullWidth>
              Explore Features
            </Button>
          </a>
        </div>

        {/* Hero Visual Mockup Preview */}
        <div className="mt-16 w-full max-w-4xl rounded-2xl border border-border bg-surface-card/80 p-2 sm:p-4 shadow-elevated backdrop-blur-md">
          <div className="rounded-xl bg-background-app/90 border border-border/80 p-4 sm:p-6 text-left">
            <div className="flex items-center justify-between pb-4 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-status-error/60" />
                <div className="w-3 h-3 rounded-full bg-status-warning/60" />
                <div className="w-3 h-3 rounded-full bg-status-success/60" />
                <span className="ml-2 font-mono text-xs text-txt-muted">
                  secure-ledger.internal // sample preview
                </span>
              </div>
              <span className="text-xs font-mono text-status-success">● SYSTEM_ONLINE</span>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-surface-card border border-border">
                <div className="text-[11px] uppercase font-semibold text-txt-muted">
                  Primary Ledger Account
                </div>
                <div className="text-xl font-bold text-txt-primary mt-1">₹45,200.00</div>
                <div className="text-[10px] text-status-success mt-1">● ACTIVE • INR</div>
              </div>

              <div className="p-4 rounded-xl bg-surface-card border border-border">
                <div className="text-[11px] uppercase font-semibold text-txt-muted">
                  Settlement Method
                </div>
                <div className="text-xl font-bold text-secondary mt-1">Atomic 2-Phase</div>
                <div className="text-[10px] text-txt-muted mt-1">MongoDB Sessions</div>
              </div>

              <div className="p-4 rounded-xl bg-surface-card border border-border">
                <div className="text-[11px] uppercase font-semibold text-txt-muted">
                  Session Security
                </div>
                <div className="text-xl font-bold text-txt-primary mt-1">JWT + Cookie</div>
                <div className="text-[10px] text-status-success mt-1">Token Protected</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-secondary">
            Core Capabilities
          </h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-txt-primary mt-2">
            Engineered for Precision & Financial Integrity
          </h3>
          <p className="text-sm text-txt-secondary mt-3">
            Every operation is designed around transactional consistency, strict access controls,
            and complete balance verifiability.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.title}
                hoverEffect
                className="p-6 transition-all duration-200 border-border"
              >
                <div className={`p-3 rounded-xl w-fit ${feature.bg} ${feature.color} mb-4`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-bold text-txt-primary mb-2">{feature.title}</h4>
                <p className="text-xs sm:text-sm text-txt-secondary leading-relaxed">
                  {feature.description}
                </p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <Card elevated className="p-8 sm:p-12 border-border/80 relative overflow-hidden">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-widest text-secondary">
              About Secure Ledger
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-txt-primary mt-2">
              Next-Generation Ledger Architecture
            </h3>
            <p className="text-xs sm:text-sm text-txt-secondary mt-4 leading-relaxed">
              Secure Ledger is a digital banking platform powered by an immutable double-entry
              accounting model. Unlike traditional balances that overwrite values, balances in
              Secure Ledger are verified by computing the difference of all immutable credit and
              debit ledger entries.
            </p>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-status-success shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold text-txt-primary">Zero Fabrication</p>
                  <p className="text-txt-muted mt-0.5">
                    Data presented reflects verified database ledger records.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-status-success shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold text-txt-primary">Idempotent Settlement</p>
                  <p className="text-txt-muted mt-0.5">
                    Strict deduplication for all transactional writes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border bg-surface-card py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-txt-muted">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-secondary" />
            <span className="text-txt-primary font-semibold">Secure Ledger</span>
            <span>— Double-Entry Demo Ledger</span>
          </div>
          <div>© {new Date().getFullYear()} Secure Ledger. Internal demonstration ledger; does not move real funds.</div>
        </div>
      </footer>
    </div>
  );
};
