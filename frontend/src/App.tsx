import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { AccountsPage } from './pages/AccountsPage';
import { TransferPage } from './pages/TransferPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { ProfilePage } from './pages/ProfilePage';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { Users, Settings as SettingsIcon } from 'lucide-react';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected Banking Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounts"
          element={
            <ProtectedRoute>
              <AccountsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transfer"
          element={
            <ProtectedRoute>
              <TransferPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transactions"
          element={
            <ProtectedRoute>
              <TransactionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/beneficiaries"
          element={
            <ProtectedRoute>
              <ComingSoonPage
                title="Beneficiary Management"
                subtitle="Whitelist and manage trusted counterparty accounts"
                icon={Users}
                description="The beneficiary management module allows you to save, verify, and tag recurring transfer recipients. This API is pending backend integration."
                expectedFeatureList={[
                  'Save frequent counterparty account IDs for 1-click transfers',
                  'Instant ledger account existence validation',
                  'Custom nickname and categorization for contacts',
                ]}
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <ComingSoonPage
                title="Account Settings & Security"
                subtitle="Configure security preferences, notifications, and ledger policies"
                icon={SettingsIcon}
                description="Granular controls over authentication parameters, notification webhooks, and ledger threshold alerts."
                expectedFeatureList={[
                  'Multi-Factor Authentication (MFA / TOTP) setup',
                  'Ledger transaction threshold email notifications',
                  'Session duration and API key management',
                ]}
              />
            </ProtectedRoute>
          }
        />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
};

export default App;
