import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight } from 'lucide-react';
import { Logo } from '../common/Logo';
import { useAuth } from '../../auth/AuthProvider';

export const PublicNavbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  return (
    <nav className="sticky top-0 z-40 bg-background-app/90 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Logo size="md" showSubtitle={false} linkTo="/" />

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-txt-secondary">
          <Link
            to="/"
            className={`transition-colors hover:text-txt-primary ${
              location.pathname === '/' ? 'text-txt-primary font-semibold' : ''
            }`}
          >
            Home
          </Link>
          <a
            href="#features"
            className="transition-colors hover:text-txt-primary"
          >
            Features
          </a>
          <a
            href="#about"
            className="transition-colors hover:text-txt-primary"
          >
            About
          </a>
        </div>

        {/* Auth CTAs */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium px-4 py-2 rounded-input shadow-glow-primary transition-all"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-medium text-txt-secondary hover:text-txt-primary px-3 py-2 rounded-input hover:bg-surface-elevated transition-colors"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center justify-center bg-primary hover:bg-primary-hover text-white text-sm font-medium px-4 py-2 rounded-input shadow-glow-primary transition-all"
              >
                Register
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger */}
        <div className="md:hidden flex items-center">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-txt-secondary hover:text-txt-primary hover:bg-surface-elevated"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-surface-card px-4 pt-2 pb-6 space-y-3">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-txt-primary hover:bg-surface-elevated"
          >
            Home
          </Link>
          <a
            href="#features"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-txt-secondary hover:bg-surface-elevated hover:text-txt-primary"
          >
            Features
          </a>
          <a
            href="#about"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-lg text-base font-medium text-txt-secondary hover:bg-surface-elevated hover:text-txt-primary"
          >
            About
          </a>
          <div className="pt-3 border-t border-border flex flex-col gap-2">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 bg-primary text-white rounded-input font-medium text-sm"
              >
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2 border border-border text-txt-primary rounded-input font-medium text-sm hover:bg-surface-elevated"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2 bg-primary text-white rounded-input font-medium text-sm shadow-glow-primary"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};
