const express = require("express");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const { createCorsMiddleware } = require("./config/cors");
const { notFoundHandler, errorHandler } = require("./middleware/error.middleware");

const app = express();

if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

app.disable("x-powered-by");
app.use(helmet());

const corsMiddleware = createCorsMiddleware();

// Configure CORS before API routes and explicitly handle OPTIONS preflight for /api routes
app.use(corsMiddleware);
app.options(/^\/api(?:\/.*)?$/, corsMiddleware);

app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

/**
 * - Routes required
 */
const authRouter = require("./routes/auth.routes");
const accountRouter = require("./routes/account.routes");
const transactionRoutes = require("./routes/transaction.routes");

/**
 * - Use Routes
 */
app.get("/", (req, res) => {
    res.send("Ledger Service is up and running");
});

app.use("/api/auth", authRouter);
app.use("/api/accounts", accountRouter);
app.use("/api/transactions", transactionRoutes);

// JSON 404 & centralized sanitized error handler
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
