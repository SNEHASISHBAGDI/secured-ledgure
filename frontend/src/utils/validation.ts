/**
 * Email format validator matching standard regex
 */
export function isValidEmail(email: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
}

/**
 * Validates password according to backend rule (minlength >= 6)
 */
export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!password || password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Generate a unique idempotency key for transactions
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}
