import { ApiError, ApiErrorResponse } from '../types/api';

const BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const TOKEN_KEY = 'secure_ledger_token';

function isValidTokenString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed !== 'undefined' && trimmed !== 'null';
}

export const tokenStorage = {
  get: (): string | null => {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (!isValidTokenString(raw)) {
        if (raw !== null) {
          localStorage.removeItem(TOKEN_KEY);
        }
        return null;
      }
      return raw.trim();
    } catch {
      return null;
    }
  },
  set: (token: string): void => {
    try {
      if (isValidTokenString(token)) {
        localStorage.setItem(TOKEN_KEY, token.trim());
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch {
      // Storage unavailable or blocked
    }
  },
  remove: (): void => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Ignore
    }
  },
};

interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const token = tokenStorage.get();
  if (isValidTokenString(token)) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (
    typeof headers['Authorization'] === 'string' &&
    /^Bearer\s+(undefined|null)?$/i.test(headers['Authorization'].trim())
  ) {
    delete headers['Authorization'];
  }

  const config: RequestInit = {
    ...options,
    headers,
    credentials: 'include', // Ensures HTTP-only / same-origin token cookies are sent
  };

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch (err) {
    throw new ApiError(
      err instanceof Error ? `Network error: ${err.message}` : 'Network error occurred. Please check connection.',
      0
    );
  }

  let data: unknown;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorData = data as ApiErrorResponse | undefined;
    const message = errorData?.message || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, errorData);
  }

  return data as T;
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions): Promise<T> =>
    request<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
};
