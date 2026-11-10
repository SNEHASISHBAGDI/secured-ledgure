const MIN_AMOUNT_PAISE = 1;
// Cap single transaction at 100,000,000,000 paise (INR 1,000,000,000.00 / 100 crore).
// Keeping individual amounts <= 10^11 guarantees summed ledger aggregations remain
// strictly within IEEE-754 safe integer precision (Number.MAX_SAFE_INTEGER ~= 9e15).
const MAX_AMOUNT_PAISE = 100000000000;

/**
 * Checks whether a value is a safe integer paise amount within valid transaction bounds.
 */
function isValidSafePaiseInteger(val) {
    return (
        typeof val === 'number' &&
        Number.isSafeInteger(val) &&
        val >= MIN_AMOUNT_PAISE &&
        val <= MAX_AMOUNT_PAISE
    );
}

/**
 * Strictly validates an API monetary input representing integer paise (1 INR = 100 paise).
 * - Accepts a finite safe integer number, or a canonical positive integer string (no decimals,
 *   no signs, no scientific notation, no leading zeros, no whitespace, no suffixes).
 * - Rejects malformed numeric strings, floats, booleans, arrays, objects, and out-of-bounds values.
 */
function validatePaiseAmount(val) {
    if (val === null || val === undefined || val === '') {
        return { valid: false, error: "Amount is required (in integer paise)" };
    }

    let minorUnits;

    if (typeof val === 'number') {
        if (!Number.isFinite(val) || !Number.isInteger(val)) {
            return {
                valid: false,
                error: "Amount must be an integer in minor units (paise), without decimal places"
            };
        }
        minorUnits = val;
    } else if (typeof val === 'string') {
        // Require canonical positive base-10 integer string: rejects decimals, signs,
        // leading zeros, whitespace, scientific notation (1e5), hex (0x10), underscores, etc.
        if (!/^[1-9]\d{0,11}$/.test(val)) {
            return {
                valid: false,
                error: "Amount must be a positive integer string in paise (e.g. '10050' for 100.50)"
            };
        }
        minorUnits = Number.parseInt(val, 10);
    } else {
        return { valid: false, error: "Amount must be a positive integer in paise" };
    }

    if (!isValidSafePaiseInteger(minorUnits)) {
        return {
            valid: false,
            error: `Amount must be a safe integer between ${MIN_AMOUNT_PAISE} and ${MAX_AMOUNT_PAISE} paise`
        };
    }

    return {
        valid: true,
        minorUnits
    };
}

/**
 * Formats an integer paise value to a 2-decimal rupee string using exact integer arithmetic.
 */
function formatPaiseToRupees(paise) {
    if (typeof paise !== 'number' || !Number.isSafeInteger(paise)) {
        return '0.00';
    }
    const sign = paise < 0 ? '-' : '';
    const abs = Math.abs(paise);
    const wholeRupees = Math.trunc(abs / 100);
    const fractionalPaise = abs % 100;
    return `${sign}${wholeRupees}.${String(fractionalPaise).padStart(2, '0')}`;
}

module.exports = {
    MIN_AMOUNT_PAISE,
    MAX_AMOUNT_PAISE,
    isValidSafePaiseInteger,
    validatePaiseAmount,
    formatPaiseToRupees
};
