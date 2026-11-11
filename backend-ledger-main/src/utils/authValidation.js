const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 128;
const MAX_EMAIL_LENGTH = 254;
const MAX_NAME_LENGTH = 100;

/**
 * Checks that the parsed JSON request body is a plain key-value object.
 */
function isPlainObject(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

/**
 * Strictly validates that email is a primitive string matching EMAIL_REGEX.
 * Rejects MongoDB operator objects (e.g. { $ne: "" }), arrays, booleans, numbers, and empty values.
 */
function validateEmail(rawEmail) {
    if (typeof rawEmail !== "string") {
        return { valid: false, error: "Email must be a valid string" };
    }
    const normalized = rawEmail.trim().toLowerCase();
    if (!normalized || normalized.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(normalized)) {
        return { valid: false, error: "Please provide a valid email address" };
    }
    return { valid: true, value: normalized };
}

/**
 * Strictly validates that password is a primitive string within length bounds.
 * Rejects objects, arrays, numbers, booleans, and empty values.
 */
function validatePassword(rawPassword, { minLength = MIN_PASSWORD_LENGTH } = {}) {
    if (typeof rawPassword !== "string") {
        return { valid: false, error: "Password must be a valid string" };
    }
    if (rawPassword.length < minLength) {
        return {
            valid: false,
            error: minLength > 1
                ? `Password must be at least ${minLength} characters long`
                : "Password is required"
        };
    }
    if (rawPassword.length > MAX_PASSWORD_LENGTH) {
        return { valid: false, error: `Password cannot exceed ${MAX_PASSWORD_LENGTH} characters` };
    }
    return { valid: true, value: rawPassword };
}

/**
 * Validates registration input strictly and returns only explicitly allowed fields.
 */
function validateRegisterPayload(body) {
    if (!isPlainObject(body)) {
        return { valid: false, error: "Request body must be a JSON object" };
    }

    if (typeof body.name !== "string" || !body.name.trim()) {
        return { valid: false, error: "Name is required and must be a non-empty string" };
    }
    const cleanName = body.name.trim();
    if (cleanName.length > MAX_NAME_LENGTH) {
        return { valid: false, error: `Name cannot exceed ${MAX_NAME_LENGTH} characters` };
    }

    const emailCheck = validateEmail(body.email);
    if (!emailCheck.valid) {
        return { valid: false, error: emailCheck.error };
    }

    const passwordCheck = validatePassword(body.password, { minLength: MIN_PASSWORD_LENGTH });
    if (!passwordCheck.valid) {
        return { valid: false, error: passwordCheck.error };
    }

    return {
        valid: true,
        data: {
            name: cleanName,
            email: emailCheck.value,
            password: passwordCheck.value
        }
    };
}

/**
 * Validates login input strictly and returns only normalized email and primitive password string.
 */
function validateLoginPayload(body) {
    if (!isPlainObject(body)) {
        return { valid: false, error: "Request body must be a JSON object" };
    }

    const emailCheck = validateEmail(body.email);
    if (!emailCheck.valid) {
        return { valid: false, error: emailCheck.error };
    }

    const passwordCheck = validatePassword(body.password, { minLength: 1 });
    if (!passwordCheck.valid) {
        return { valid: false, error: passwordCheck.error };
    }

    return {
        valid: true,
        data: {
            email: emailCheck.value,
            password: passwordCheck.value
        }
    };
}

module.exports = {
    EMAIL_REGEX,
    MIN_PASSWORD_LENGTH,
    MAX_PASSWORD_LENGTH,
    validateEmail,
    validatePassword,
    validateRegisterPayload,
    validateLoginPayload
};
