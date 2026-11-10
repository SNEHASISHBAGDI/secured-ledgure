const mongoose = require("mongoose")
const { MIN_AMOUNT_PAISE, MAX_AMOUNT_PAISE, isValidSafePaiseInteger } = require("../utils/monetary")


const transactionSchema = new mongoose.Schema({
    fromAccount: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "account",
        required: [ true, "Transaction must be associated with a from account" ],
        index: true
    },
    toAccount: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "account",
        required: [ true, "Transaction must be associated with a to account" ],
        index: true
    },
    status: {
        type: String,
        enum: {
            values: [ "PENDING", "COMPLETED", "FAILED", "REVERSED" ],
            message: "Status can be either PENDING, COMPLETED, FAILED or REVERSED",
        },
        default: "PENDING"
    },
    amount: {
        // Stored as safe integer paise (1 INR = 100 paise). Never stores a float.
        type: Number,
        required: [ true, "Amount is required for creating a transaction" ],
        min: [ MIN_AMOUNT_PAISE, "Transaction amount must be at least 1 paise" ],
        max: [ MAX_AMOUNT_PAISE, "Transaction amount exceeds safe upper limit" ],
        validate: {
            validator: isValidSafePaiseInteger,
            message: "Transaction amount must be a safe positive integer (paise)"
        }
    },
    idempotencyKey: {
        type: String,
        required: [ true, "Idempotency Key is required for creating a transaction" ],
        index: true,
        unique: true
    }
}, {
    timestamps: true
})

transactionSchema.index({ fromAccount: 1, createdAt: -1 })
transactionSchema.index({ toAccount: 1, createdAt: -1 })

const transactionModel = mongoose.model("transaction", transactionSchema)


module.exports = transactionModel   