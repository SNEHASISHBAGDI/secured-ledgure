/**
 * Handles unmatched routes cleanly with structured JSON rather than default HTML 404 output.
 */
function notFoundHandler(req, res) {
    return res.status(404).json({
        message: "Route not found"
    });
}

/**
 * Centralized production-safe JSON error handler.
 * Maps Mongoose / MongoDB / body-parser client errors cleanly and prevents stack-trace,
 * model, collection, index, or filesystem-path leakage.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
    if (res.headersSent) {
        return;
    }

    // Malformed JSON body sent to express.json()
    if (err && (err.type === "entity.parse.failed" || (err instanceof SyntaxError && err.status === 400))) {
        return res.status(400).json({
            message: "Malformed JSON request body"
        });
    }

    // Payload too large
    if (err && (err.type === "entity.too.large" || err.status === 413)) {
        return res.status(413).json({
            message: "Request payload too large"
        });
    }

    // Mongoose schema validation error (sanitized — no internal paths/model names)
    if (err && err.name === "ValidationError") {
        return res.status(400).json({
            message: "Request validation failed"
        });
    }

    // Mongoose CastError (e.g. malformed ObjectId or unexpected type in query/body)
    if (err && err.name === "CastError") {
        return res.status(400).json({
            message: "Invalid identifier or input format"
        });
    }

    // MongoDB duplicate-key conflict (sanitized — never exposes collection or index name)
    if (err && (err.code === 11000 || (err.name === "MongoServerError" && err.code === 11000))) {
        return res.status(409).json({
            message: "Resource conflict"
        });
    }

    // Explicit operational HTTP client errors (< 500)
    const statusCode = Number.isInteger(err?.statusCode)
        ? err.statusCode
        : Number.isInteger(err?.status)
            ? err.status
            : 500;

    if (statusCode >= 400 && statusCode < 500) {
        return res.status(statusCode).json({
            message: err.message || "Bad request"
        });
    }

    console.error("Unhandled server error:", err?.message || "Unknown error");
    return res.status(500).json({
        message: "Internal server error"
    });
}

module.exports = {
    notFoundHandler,
    errorHandler
};
