const cors = require("cors");

const DEFAULT_DEPLOYED_FRONTEND_ORIGIN = "https://secured-ledgure-frontend.onrender.com";
const LOCAL_DEV_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173"
];

/**
 * Normalizes and validates an origin string. Rejects wildcards ("*") and non-HTTP(S) origins.
 */
function parseStrictOrigin(rawOrigin) {
    if (typeof rawOrigin !== "string") {
        return null;
    }
    const trimmed = rawOrigin.trim();
    if (!trimmed || trimmed === "*") {
        return null;
    }
    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
            return null;
        }
        return parsed.origin;
    } catch {
        return null;
    }
}

/**
 * Builds the exact allowed-origin allowlist from FRONTEND_ORIGIN and NODE_ENV.
 * - Never allows "*" (incompatible with credentials: true and unsafe).
 * - In production, allows only FRONTEND_ORIGIN (defaulting to the deployed Render frontend).
 * - Outside production, also allows the local Vite dev server origins.
 */
function getAllowedOrigins(env = process.env) {
    const allowedOrigins = new Set();
    const rawEnvOrigin = env.FRONTEND_ORIGIN;

    if (typeof rawEnvOrigin === "string" && rawEnvOrigin.trim().length > 0) {
        for (const entry of rawEnvOrigin.split(",")) {
            const normalized = parseStrictOrigin(entry);
            if (normalized) {
                allowedOrigins.add(normalized);
            }
        }
    }

    if (allowedOrigins.size === 0) {
        allowedOrigins.add(DEFAULT_DEPLOYED_FRONTEND_ORIGIN);
    }

    if (env.NODE_ENV !== "production") {
        for (const localOrigin of LOCAL_DEV_ORIGINS) {
            allowedOrigins.add(localOrigin);
        }
    }

    return allowedOrigins;
}

/**
 * Creates configured CORS options and middleware for the Express app.
 */
function createCorsOptions(env = process.env) {
    const allowedOrigins = getAllowedOrigins(env);

    return {
        origin(requestOrigin, callback) {
            // Non-browser / same-origin requests without an Origin header pass without setting CORS headers.
            if (!requestOrigin) {
                return callback(null, false);
            }

            const normalizedRequestOrigin = parseStrictOrigin(requestOrigin);
            if (normalizedRequestOrigin && allowedOrigins.has(normalizedRequestOrigin)) {
                return callback(null, normalizedRequestOrigin);
            }

            // Disallow without throwing an unhandled 500 error; omitting Access-Control-Allow-Origin
            // causes browsers to reject the cross-origin / preflight request securely.
            return callback(null, false);
        },
        credentials: true,
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        optionsSuccessStatus: 204
    };
}

function createCorsMiddleware(env = process.env) {
    return cors(createCorsOptions(env));
}

module.exports = {
    DEFAULT_DEPLOYED_FRONTEND_ORIGIN,
    LOCAL_DEV_ORIGINS,
    parseStrictOrigin,
    getAllowedOrigins,
    createCorsOptions,
    createCorsMiddleware
};
