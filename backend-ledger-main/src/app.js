const express = require("express")
const cookieParser = require("cookie-parser")
const { createCorsMiddleware } = require("./config/cors")



const app = express()
const corsMiddleware = createCorsMiddleware()

// Configure CORS before API routes and explicitly handle OPTIONS preflight for /api routes
app.use(corsMiddleware)
app.options(/^\/api(?:\/.*)?$/, corsMiddleware)


app.use(express.json())
app.use(cookieParser())

/**
 * - Routes required
 */
const authRouter = require("./routes/auth.routes")
const accountRouter = require("./routes/account.routes")
const transactionRoutes = require("./routes/transaction.routes")

/**
 * - Use Routes
 */

app.get("/", (req, res) => {
    res.send("Ledger Service is up and running")
})

app.use("/api/auth", authRouter)
app.use("/api/accounts", accountRouter)
app.use("/api/transactions", transactionRoutes)

module.exports = app