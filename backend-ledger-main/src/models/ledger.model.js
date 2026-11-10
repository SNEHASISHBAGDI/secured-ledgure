const mongoose = require('mongoose');
const { MIN_AMOUNT_PAISE, MAX_AMOUNT_PAISE, isValidSafePaiseInteger } = require('../utils/monetary');


const ledgerSchema = new mongoose.Schema({
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "account",
        required: [ true, "Ledger must be associated with an account" ],
        index: true,
        immutable: true
    },
    amount: {
        // Stored as safe integer paise (1 INR = 100 paise). Never stores a float.
        type: Number,
        required: [ true, "Amount is required for creating a ledger entry" ],
        min: [ MIN_AMOUNT_PAISE, "Ledger amount must be at least 1 paise" ],
        max: [ MAX_AMOUNT_PAISE, "Ledger amount exceeds safe upper limit" ],
        validate: {
            validator: isValidSafePaiseInteger,
            message: "Ledger amount must be a safe positive integer (paise)"
        },
        immutable: true
    },
    transaction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "transaction",
        required: [ true, "Ledger must be associated with a transaction" ],
        index: true,
        immutable: true
    },
    type: {
        type: String,
        enum: {
            values: [ "CREDIT", "DEBIT" ],
            message: "Type can be either CREDIT or DEBIT",
        },
        required: [ true, "Ledger type is required" ],
        immutable: true
    }
})


function preventLedgerModification() {
    throw new Error("Ledger entries are immutable and cannot be modified or deleted");
}

ledgerSchema.pre('findOneAndUpdate', preventLedgerModification);
ledgerSchema.pre('updateOne', preventLedgerModification);
ledgerSchema.pre('deleteOne', preventLedgerModification);
ledgerSchema.pre('remove', preventLedgerModification);
ledgerSchema.pre('deleteMany', preventLedgerModification);
ledgerSchema.pre('updateMany', preventLedgerModification);
ledgerSchema.pre("findOneAndDelete", preventLedgerModification);
ledgerSchema.pre("findOneAndReplace", preventLedgerModification);


const ledgerModel = mongoose.model('ledger', ledgerSchema);

module.exports = ledgerModel;