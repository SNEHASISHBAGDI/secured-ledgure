const { rateLimit } = require("express-rate-limit");

const DEFAULT_AUTH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function parsePositiveInt(rawValue, fallback) {
    if (rawValue === undefined || rawValue === null || rawValue === "") {
        return fallback;
    }
    const parsed = Number.parseInt(String(rawValue), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Creates an IP-based rate limiter for authentication-sensitive endpoints.
 * Production defaults:
 *  - Login: 15 attempts / 15 min
 *  - Register: 10 attempts / 15 min
 *  - Logout: 30 attempts / 15 min
 *
 * In NODE_ENV=test, defaults to 500 requests / window so multi-suite integration
 * runs do not collide on 127.0.0.1, unless AUTH_RATE_LIMIT_MAX is explicitly set
 * (allowing deterministic 429 enforcement tests without bypassing the middleware).
 */
function createAuthRateLimiter({ windowMs = DEFAULT_AUTH_WINDOW_MS, max, message }) {
    const isTest = process.env.NODE_ENV === "test";
    const resolvedWindowMs = parsePositiveInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, windowMs);
    const defaultMax = isTest ? 500 : max;
    const resolvedMax = parsePositiveInt(process.env.AUTH_RATE_LIMIT_MAX, defaultMax);

    return rateLimit({
        windowMs: resolvedWindowMs,
        limit: resolvedMax,
        standardHeaders: true,
        legacyHeaders: false,
        handler(req, res) {
            return res.status(429).json({
                message: message || "Too many authentication attempts. Please try again later."
            });
        }
    });
}

function createAuthLimiters() {
    return {
        registerRateLimiter: createAuthRateLimiter({
            windowMs: DEFAULT_AUTH_WINDOW_MS,
            max: 10,
            message: "Too many registration attempts. Please try again later."
        }),
        loginRateLimiter: createAuthRateLimiter({
            windowMs: DEFAULT_AUTH_WINDOW_MS,
            max: 15,
            message: "Too many login attempts. Please try again later."
        }),
        logoutRateLimiter: createAuthRateLimiter({
            windowMs: DEFAULT_AUTH_WINDOW_MS,
            max: 30,
            message: "Too many logout requests. Please try again later."
        })
    };
}

module.exports = {
    DEFAULT_AUTH_WINDOW_MS,
    createAuthRateLimiter,
    createAuthLimiters
};
