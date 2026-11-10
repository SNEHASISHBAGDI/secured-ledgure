import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import { Logo } from '../components/common/Logo';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { useAuth } from '../auth/AuthProvider';
import { isValidEmail } from '../utils/validation';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Return to the previous route or fallback to /dashboard
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!isValidEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Unable to sign in. Please verify your email and password.';
      setErrors({ general: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-app text-txt-primary flex flex-col justify-center items-center p-4 sm:p-6">
      {/* Decorative background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        <div className="text-center flex flex-col items-center">
          <Logo size="lg" linkTo="/" />
          <h1 className="text-2xl sm:text-3xl font-bold text-txt-primary mt-6 tracking-tight">
            Welcome Back
          </h1>
          <p className="text-xs sm:text-sm text-txt-secondary mt-1.5">
            Enter your credentials to access your secure accounts
          </p>
        </div>

        <Card elevated className="p-6 sm:p-8">
          {errors.general && (
            <div className="mb-5 p-3.5 rounded-lg bg-status-error/15 border border-status-error/30 flex items-start gap-2.5 text-xs text-status-error">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errors.general}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              leftIcon={<Mail className="w-4 h-4" />}
              autoComplete="email"
              autoFocus
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              leftIcon={<Lock className="w-4 h-4" />}
              allowPasswordToggle
              autoComplete="current-password"
            />

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                fullWidth
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Sign In to Ledger
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-border text-center text-xs text-txt-secondary">
            Don&apos;t have an account yet?{' '}
            <Link
              to="/register"
              className="text-secondary hover:text-primary-light font-semibold ml-1 transition-colors"
            >
              Register here
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};
