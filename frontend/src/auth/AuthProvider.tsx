import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, LoginCredentials, RegisterCredentials, AuthContextType } from '../types/auth';
import { loginApi, registerApi, logoutApi } from '../api/auth.api';
import { tokenStorage } from '../api/client';

const USER_STORAGE_KEY = 'secure_ledger_user';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(USER_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => tokenStorage.get());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Initial verification of session state
    const savedToken = tokenStorage.get();
    const savedUser = localStorage.getItem(USER_STORAGE_KEY);

    if (savedToken && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        setToken(savedToken);
      } catch {
        tokenStorage.remove();
        localStorage.removeItem(USER_STORAGE_KEY);
        setUser(null);
        setToken(null);
      }
    } else {
      setUser(null);
      setToken(null);
    }
    setIsLoading(false);
  }, []);

  const persistSession = (nextUser: User, nextToken: unknown) => {
    const validToken =
      typeof nextToken === 'string' &&
      nextToken.trim().length > 0 &&
      nextToken.trim() !== 'undefined' &&
      nextToken.trim() !== 'null'
        ? nextToken.trim()
        : null;

    setUser(nextUser);
    setToken(validToken);

    if (validToken) {
      tokenStorage.set(validToken);
    } else {
      tokenStorage.remove();
    }

    try {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
    } catch {
      // Storage unavailable
    }
  };

  const login = async (credentials: LoginCredentials): Promise<void> => {
    const data = await loginApi(credentials);
    persistSession(data.user, data.token);
  };

  const register = async (credentials: RegisterCredentials): Promise<void> => {
    const data = await registerApi(credentials);
    persistSession(data.user, data.token);
  };

  const logout = async (): Promise<void> => {
    try {
      await logoutApi();
    } catch {
      // Ignore network logout errors during client teardown
    } finally {
      setUser(null);
      setToken(null);
      tokenStorage.remove();
      try {
        localStorage.removeItem(USER_STORAGE_KEY);
      } catch {
        // Ignore
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
