export const MIN_AMOUNT_PAISE = 1;
// Must match backend MAX_AMOUNT_PAISE (100,000,000,000 paise = ₹1,000,000,000.00)
export const MAX_AMOUNT_PAISE = 100000000000;

/**
 * Parses a major-unit currency input string (e.g. "100.50") strictly into integer paise
 * using string splitting and integer arithmetic only — zero IEEE-754 floating-point math.
 *
 * Rejects malformed numeric strings (scientific notation, leading zeros like "010",
 * trailing dots "100.", leading dots ".50", signs "+10"/"-10", >2 decimals, non-digits).
 */
export function parseMajorToPaise(raw: string): {
  valid: boolean;
  paise: number | null;
  error?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, paise: null };
  }

  // Canonical positive decimal format with at most 2 fractional digits:
  // whole part must be "0" or non-zero-leading digits; fractional part if present must be 1-2 digits.
  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(trimmed)) {
    return {
      valid: false,
      paise: null,
      error: 'Enter a valid positive amount with up to 2 decimal places (e.g. 100 or 100.50)',
    };
  }

  const [intPartStr, fracPartStr = ''] = trimmed.split('.');

  // Guard integer overflow before multiplication (max 10 whole digits = 9,999,999,999 rupees)
  if (intPartStr.length > 10) {
    return {
      valid: false,
      paise: null,
      error: 'Amount exceeds maximum allowed transfer limit (₹1,00,00,00,000.00)',
    };
  }

  const wholeRupees = Number.parseInt(intPartStr, 10);
  const paiseFraction = Number.parseInt(fracPartStr.padEnd(2, '0'), 10);
  const totalPaise = wholeRupees * 100 + paiseFraction;

  if (!Number.isSafeInteger(totalPaise) || totalPaise < MIN_AMOUNT_PAISE) {
    return {
      valid: false,
      paise: null,
      error: 'Amount must be at least ₹0.01',
    };
  }

  if (totalPaise > MAX_AMOUNT_PAISE) {
    return {
      valid: false,
      paise: null,
      error: 'Amount exceeds maximum allowed transfer limit (₹1,00,00,00,000.00)',
    };
  }

  return {
    valid: true,
    paise: totalPaise,
  };
}

/**
 * Formats a numeric amount with the given currency code (defaults to INR).
 * Expects the amount already in major units (rupees), NOT paise.
 * For API balances and transaction amounts (which are integer paise), use formatPaise() instead.
 */
export function formatCurrency(amount: number | undefined | null, currency = 'INR'): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '—';
  }

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Formats an integer paise value as a display currency string.
 * The API returns all balance and transaction amounts as integer paise (1 INR = 100 paise).
 *
 * @param paise - Integer paise value from the API (e.g. 150000 = ₹1,500.00)
 * @param currency - ISO currency code (default 'INR')
 */
export function formatPaise(paise: number | undefined | null, currency = 'INR'): string {
  if (paise === undefined || paise === null || !Number.isFinite(paise)) {
    return '—';
  }
  return formatCurrency(paise / 100, currency);
}

/**
 * Mask account ID to display last 4 characters safely
 * e.g., "65f2a1b94e1d4b0012345678" -> "•••• 5678"
 */
export function maskAccountId(accountId: string): string {
  if (!accountId) return '—';
  const clean = accountId.trim();
  if (clean.length <= 4) return clean;
  const last4 = clean.slice(-4);
  return `•••• ${last4.toUpperCase()}`;
}

/**
 * Truncate long IDs for compact badge view
 */
export function shortId(id: string): string {
  if (!id) return '';
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}...${id.slice(-4)}`;
}
