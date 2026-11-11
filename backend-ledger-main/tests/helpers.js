const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const userModel = require("../src/models/user.model");
const accountModel = require("../src/models/account.model");
const ledgerModel = require("../src/models/ledger.model");
const transactionModel = require("../src/models/transaction.model");

/**
 * Generates a unique idempotency key matching backend format constraints.
 */
function generateUniqueIdempotencyKey(prefix = "tx-key") {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Registers a user through the real API and returns response + credentials + user/token.
 */
async function registerTestUser(overrides = {}) {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = {
        name: overrides.name ?? `Test User ${uniqueSuffix}`,
        email: overrides.email ?? `user-${uniqueSuffix}@example.com`,
        password: overrides.password ?? "StrongPass123",
        ...overrides
    };

    const res = await request(app).post("/api/auth/register").send(payload);
    return { res, payload, user: res.body.user, token: res.body.token };
}

/**
 * Creates a system user directly in the test DB (since systemUser cannot be set via public API).
 */
async function createSystemUserInDb(overrides = {}) {
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return userModel.create({
        name: overrides.name ?? "System Administrator",
        email: overrides.email ?? `sysadmin-${uniqueSuffix}@example.com`,
        password: overrides.password ?? "SystemSecret123",
        systemUser: true
    });
}

/**
 * Creates a ledger account through POST /api/accounts/ for the given Bearer token.
 */
async function createAccountForToken(token) {
    const res = await request(app)
        .post("/api/accounts/")
        .set("Authorization", `Bearer ${token}`)
        .send({});
    return res;
}

/**
 * Seeds a known balance (in integer paise) onto an account directly in the isolated test DB
 * via an immutable CREDIT ledger entry. Note: this creates no Transaction document so
 * GET /api/transactions/ starts clean unless transfers occur.
 */
async function seedAccountBalance(accountId, amountPaise) {
    const openingRefId = new mongoose.Types.ObjectId();
    return ledgerModel.create({
        account: accountId,
        amount: amountPaise,
        transaction: openingRefId,
        type: "CREDIT"
    });
}

/**
 * Seeds a known balance (in integer paise) using a balanced double-entry funding pair
 * (DEBIT on treasuryAccountId, CREDIT on targetAccountId) + COMPLETED funding transaction,
 * so the global ledger collection maintains SUM(DEBIT) === SUM(CREDIT).
 */
async function seedBalancedFromTreasury(treasuryAccountId, targetAccountId, amountPaise) {
    const tx = await transactionModel.create({
        fromAccount: treasuryAccountId,
        toAccount: targetAccountId,
        amount: amountPaise,
        idempotencyKey: generateUniqueIdempotencyKey("treasury-seed"),
        status: "COMPLETED"
    });
    await ledgerModel.create([
        { account: treasuryAccountId, amount: amountPaise, transaction: tx._id, type: "DEBIT" },
        { account: targetAccountId, amount: amountPaise, transaction: tx._id, type: "CREDIT" }
    ]);
    return tx;
}

/**
 * Reads derived balance directly from MongoDB using Account.methods.getBalance().
 */
async function getAccountBalanceFromDb(accountId) {
    const acc = await accountModel.findById(accountId);
    if (!acc) return null;
    return acc.getBalance();
}

/**
 * Reads all ledger entries for an account or transaction directly from MongoDB.
 */
async function getAccountLedgerEntries(accountId) {
    return ledgerModel.find({ account: accountId }).lean();
}

/**
 * Submits a transfer through POST /api/transactions/.
 */
async function performTransfer(token, { fromAccount, toAccount, amount, idempotencyKey }) {
    return request(app)
        .post("/api/transactions/")
        .set("Authorization", `Bearer ${token}`)
        .send({
            fromAccount,
            toAccount,
            amount,
            idempotencyKey: idempotencyKey ?? generateUniqueIdempotencyKey()
        });
}

module.exports = {
    generateUniqueIdempotencyKey,
    registerTestUser,
    createSystemUserInDb,
    createAccountForToken,
    seedAccountBalance,
    seedBalancedFromTreasury,
    getAccountBalanceFromDb,
    getAccountLedgerEntries,
    performTransfer
};
