const transactionModel = require("../models/transaction.model");
const ledgerModel = require("../models/ledger.model");
const accountModel = require("../models/account.model");
const emailService = require("../services/email.service");
const mongoose = require("mongoose");
const crypto = require("crypto");
const { validatePaiseAmount, formatPaiseToRupees } = require("../utils/monetary");

/**
 * Validates a 24-character hexadecimal MongoDB ObjectId string.
 */
function isValidObjectId(id) {
    return typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id.trim());
}

/**
 * Escapes special regular-expression characters to prevent ReDoS or syntax errors.
 */
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Constant-time secret comparison using fixed-length SHA-256 digests so neither
 * byte differences nor length differences can be leaked via timing side channels.
 */
function safeCompareSecrets(expected, provided) {
    if (typeof expected !== "string" || typeof provided !== "string") {
        return false;
    }
    if (!expected || !provided) {
        return false;
    }
    const expectedDigest = crypto.createHash("sha256").update(expected, "utf8").digest();
    const providedDigest = crypto.createHash("sha256").update(provided, "utf8").digest();
    return crypto.timingSafeEqual(expectedDigest, providedDigest);
}

/**
 * Serializes a transaction for safe API responses (amount is integer paise;
 * internal idempotencyKey is intentionally omitted).
 */
function serializeTransaction(tx) {
    return {
        _id: tx._id,
        fromAccount: tx.fromAccount,
        toAccount: tx.toAccount,
        amount: tx.amount,
        unit: "PAISE",
        status: tx.status,
        createdAt: tx.createdAt
    };
}

/**
 * Verifies ownership and exact payload match for an existing idempotent transaction record.
 * Never returns another user's transaction details and never accepts key reuse for a different payload.
 */
async function resolveIdempotentReplayOrConflict({
    existingTx,
    userId,
    cleanFromId,
    cleanToId,
    transferMinorUnits,
    res
}) {
    const existingOwnerAccount = await accountModel.findOne({
        _id: existingTx.fromAccount,
        user: userId
    });

    const payloadMatches =
        existingTx.fromAccount.toString() === cleanFromId &&
        existingTx.toAccount.toString() === cleanToId &&
        existingTx.amount === transferMinorUnits;

    if (!existingOwnerAccount || !payloadMatches) {
        return res.status(409).json({
            message: "Idempotency key conflict. Please generate a new transfer."
        });
    }

    if (existingTx.status === "COMPLETED") {
        return res.status(200).json({
            message: "Transaction already processed",
            transaction: serializeTransaction(existingTx)
        });
    }

    if (existingTx.status === "PENDING") {
        return res.status(409).json({
            message: "Transaction is currently being processed. Please check back shortly."
        });
    }

    if (existingTx.status === "FAILED") {
        return res.status(409).json({
            message: "A previous transfer attempt with this idempotency key failed. Please generate a new transfer."
        });
    }

    return res.status(409).json({
        message: "Idempotency key conflict. Please generate a new transfer."
    });
}

/**
 * - Create a new transfer transaction
 * POST /api/transactions/
 *
 * Security Controls Enforced:
 *  1. Strict input validation and integer paise parsing (no float arithmetic end to end).
 *  2. Authenticated user ownership of source account verified BEFORE idempotency lookup.
 *  3. Idempotency replay requires same authenticated owner + exact same fromAccount, toAccount, and amount.
 *  4. Source and destination account IDs validated, distinct, active, and same currency.
 *  5. Concurrent overspending prevented via pessimistic document write-lock on source account.
 *  6. Balance recalculated inside transaction snapshot after acquiring write lock (exact integer paise).
 *  7. Transaction record, DEBIT ledger entry, and CREDIT ledger entry committed atomically.
 *  8. Duplicate-key (11000) catch handler applies the same ownership + payload verification.
 *  9. Safe session abort and guaranteed session cleanup on all error branches.
 */
async function createTransaction(req, res) {
    const { fromAccount, toAccount, amount, idempotencyKey } = req.body || {};

    // 1. Validate required fields
    if (!fromAccount || !toAccount || amount === undefined || amount === null || !idempotencyKey) {
        return res.status(400).json({
            message: "fromAccount, toAccount, amount, and idempotencyKey are required"
        });
    }

    // 2. Validate account ID formats
    if (!isValidObjectId(fromAccount) || !isValidObjectId(toAccount)) {
        return res.status(400).json({
            message: "Invalid account identifier format"
        });
    }

    const cleanFromId = fromAccount.trim();
    const cleanToId = toAccount.trim();

    // 3. Ensure source and destination differ
    if (cleanFromId === cleanToId) {
        return res.status(400).json({
            message: "Source and recipient accounts must be different"
        });
    }

    // 4. Validate integer paise amount strictly (bounds + malformed string rejection)
    const amountValidation = validatePaiseAmount(amount);
    if (!amountValidation.valid) {
        return res.status(400).json({
            message: amountValidation.error
        });
    }

    const { minorUnits: transferMinorUnits } = amountValidation;

    // 5. Validate idempotencyKey strictly as a canonical token string
    if (typeof idempotencyKey !== "string") {
        return res.status(400).json({
            message: "idempotencyKey must be a string"
        });
    }

    const cleanIdempotencyKey = idempotencyKey.trim();
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(cleanIdempotencyKey)) {
        return res.status(400).json({
            message: "idempotencyKey must be 8-128 characters using letters, numbers, '.', '_', ':', or '-'"
        });
    }

    // 6. OWNERSHIP CHECK FIRST — Enforce that authenticated user owns the source account
    //    before performing any idempotency key lookup or existence disclosure.
    const fromUserAccount = await accountModel.findOne({
        _id: cleanFromId,
        user: req.user._id
    });

    if (!fromUserAccount) {
        return res.status(404).json({
            message: "Source account not found or access denied"
        });
    }

    if (fromUserAccount.status !== "ACTIVE") {
        return res.status(400).json({
            message: "Source account is not active and cannot initiate transfers"
        });
    }

    // 7. Idempotency pre-check AFTER source ownership authorization
    const existingTx = await transactionModel.findOne({ idempotencyKey: cleanIdempotencyKey });
    if (existingTx) {
        return resolveIdempotentReplayOrConflict({
            existingTx,
            userId: req.user._id,
            cleanFromId,
            cleanToId,
            transferMinorUnits,
            res
        });
    }

    // 8. Recipient Account Check: Must be active; do not leak user/sensitive data
    const toUserAccount = await accountModel.findOne({
        _id: cleanToId,
        status: "ACTIVE"
    });

    if (!toUserAccount) {
        return res.status(404).json({
            message: "Recipient account not found or is not active"
        });
    }

    // 9. Compatible Currency Check (do not expose arbitrary recipient account attributes)
    if (fromUserAccount.currency !== toUserAccount.currency) {
        return res.status(400).json({
            message: "Currency mismatch between source and recipient accounts"
        });
    }

    // 10. Execute Atomic Multi-Document Transaction with Concurrency Locking
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Step A: Acquire exclusive write lock on source account inside the session.
        // In MongoDB transactions, updating a document acquires an exclusive document write-lock.
        // Any concurrent transaction attempting to debit the same source account will block
        // or encounter a write conflict, preventing concurrent overspending.
        const lockedFromAccount = await accountModel.findOneAndUpdate(
            { _id: cleanFromId, user: req.user._id, status: "ACTIVE" },
            { $set: { updatedAt: new Date() } },
            { session, new: true }
        );

        if (!lockedFromAccount) {
            await session.abortTransaction();
            return res.status(400).json({
                message: "Source account is no longer active or accessible"
            });
        }

        // Step B: Verify recipient account is still active in this session snapshot
        const lockedToAccount = await accountModel.findOne({
            _id: cleanToId,
            status: "ACTIVE"
        }).session(session);

        if (!lockedToAccount) {
            await session.abortTransaction();
            return res.status(404).json({
                message: "Recipient account is no longer active or accessible"
            });
        }

        if (lockedFromAccount.currency !== lockedToAccount.currency) {
            await session.abortTransaction();
            return res.status(400).json({
                message: "Currency mismatch between source and recipient accounts"
            });
        }

        // Step C: Recalculate balance in exact integer paise inside the transaction snapshot
        // AFTER acquiring the write lock.
        const currentBalancePaise = await lockedFromAccount.getBalance(session);

        if (currentBalancePaise < transferMinorUnits) {
            await session.abortTransaction();
            const availableFormatted = formatPaiseToRupees(currentBalancePaise);
            const requestedFormatted = formatPaiseToRupees(transferMinorUnits);
            return res.status(400).json({
                message: `Insufficient balance. Available: ${availableFormatted} ${lockedFromAccount.currency}, Requested: ${requestedFormatted} ${lockedFromAccount.currency}`
            });
        }

        // Step D: Create the transaction record — amount stored as safe integer paise.
        // If an identical idempotencyKey was committed concurrently, this throws error 11000.
        const [transaction] = await transactionModel.create([{
            fromAccount: cleanFromId,
            toAccount: cleanToId,
            amount: transferMinorUnits,
            idempotencyKey: cleanIdempotencyKey,
            status: "PENDING"
        }], { session });

        // Step E: Create immutable DEBIT ledger entry — amount in safe integer paise
        await ledgerModel.create([{
            account: cleanFromId,
            amount: transferMinorUnits,
            transaction: transaction._id,
            type: "DEBIT"
        }], { session });

        // Step F: Create immutable CREDIT ledger entry — amount in safe integer paise
        await ledgerModel.create([{
            account: cleanToId,
            amount: transferMinorUnits,
            transaction: transaction._id,
            type: "CREDIT"
        }], { session });

        // Step G: Mark transaction status COMPLETED
        transaction.status = "COMPLETED";
        await transaction.save({ session });

        // Step H: Commit MongoDB session
        await session.commitTransaction();

        // Step I: Send asynchronous email notification (non-blocking, formatted in major units)
        setImmediate(async () => {
            try {
                await emailService.sendTransactionEmail(
                    req.user.email,
                    req.user.name,
                    formatPaiseToRupees(transferMinorUnits),
                    cleanToId
                );
            } catch (emailErr) {
                console.error("Non-fatal email notification failure:", emailErr.message);
            }
        });

        return res.status(201).json({
            message: "Transfer completed successfully",
            transaction: serializeTransaction(transaction)
        });

    } catch (error) {
        if (session.inTransaction()) {
            try {
                await session.abortTransaction();
            } catch {
                // Session may already be aborted by MongoDB on write conflict; ignore secondary abort error
            }
        }

        // Handle duplicate key error (concurrent idempotent request reached DB simultaneously)
        if (error.code === 11000 || (error.name === "MongoServerError" && error.code === 11000)) {
            const existing = await transactionModel.findOne({ idempotencyKey: cleanIdempotencyKey });
            if (existing) {
                return resolveIdempotentReplayOrConflict({
                    existingTx: existing,
                    userId: req.user._id,
                    cleanFromId,
                    cleanToId,
                    transferMinorUnits,
                    res
                });
            }
            return res.status(409).json({
                message: "Idempotency key conflict. Please generate a new transfer."
            });
        }

        // Handle MongoDB transaction write conflicts / transient transaction errors
        if ((error.hasErrorLabel && error.hasErrorLabel("TransientTransactionError")) || error.code === 112) {
            return res.status(409).json({
                message: "Account was concurrently modified by another operation. Please retry your transfer."
            });
        }

        console.error("Transfer transaction error:", error.message);
        return res.status(500).json({
            message: "Transfer processing failed due to an internal ledger error. Please retry."
        });
    } finally {
        await session.endSession();
    }
}

/**
 * - GET /api/transactions/
 * Retrieves transaction history scoped strictly to the authenticated user's accounts.
 *
 * Security Controls:
 * - Only returns transactions where the authenticated user owns at least one involved account.
 * - ObjectId search preserves the ownership constraint via $and.
 * - Non-ObjectId search applies escaped regex on idempotencyKey ONLY for user-initiated transactions
 *   (fromAccount in userAccountIds), preventing recipients from probing sender idempotency keys.
 * - idempotencyKey is omitted from serialized history items.
 */
async function getTransactionHistory(req, res) {
    try {
        const userAccounts = await accountModel.find({ user: req.user._id }).select("_id");
        const userAccountIds = userAccounts.map(a => a._id);
        const userAccountIdSet = new Set(userAccountIds.map(id => id.toString()));

        if (userAccountIds.length === 0) {
            return res.status(200).json({
                transactions: [],
                total: 0,
                page: 1,
                totalPages: 0
            });
        }

        const page = Math.max(1, Math.min(10000, parseInt(req.query.page, 10) || 1));
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
        const skip = (page - 1) * limit;

        const rawType = req.query.type;
        let normalizedType = "ALL";
        if (rawType !== undefined) {
            if (typeof rawType !== "string") {
                return res.status(400).json({ message: "Invalid transaction filter type" });
            }
            const upperType = rawType.trim().toUpperCase();
            if (!["ALL", "CREDIT", "DEBIT"].includes(upperType)) {
                return res.status(400).json({ message: "Invalid transaction filter type" });
            }
            normalizedType = upperType;
        }

        const rawSearch = req.query.search;
        if (rawSearch !== undefined && typeof rawSearch !== "string") {
            return res.status(400).json({ message: "Invalid search query format" });
        }

        // Base ownership constraint: always ensures user owns at least one involved account.
        let ownershipFilter;
        if (normalizedType === "CREDIT") {
            ownershipFilter = { toAccount: { $in: userAccountIds } };
        } else if (normalizedType === "DEBIT") {
            ownershipFilter = { fromAccount: { $in: userAccountIds } };
        } else {
            ownershipFilter = {
                $or: [
                    { fromAccount: { $in: userAccountIds } },
                    { toAccount: { $in: userAccountIds } }
                ]
            };
        }

        let filter = ownershipFilter;

        if (typeof rawSearch === "string" && rawSearch.trim()) {
            const cleanSearch = rawSearch.trim().slice(0, 128);
            if (isValidObjectId(cleanSearch)) {
                const searchObjId = new mongoose.Types.ObjectId(cleanSearch);
                filter = {
                    $and: [
                        ownershipFilter,
                        {
                            $or: [
                                { _id: searchObjId },
                                { fromAccount: searchObjId },
                                { toAccount: searchObjId }
                            ]
                        }
                    ]
                };
            } else {
                // Restrict idempotencyKey search to transactions initiated by the authenticated user
                // so recipients cannot oracle-probe a sender's private idempotency keys.
                filter = {
                    $and: [
                        ownershipFilter,
                        { fromAccount: { $in: userAccountIds } },
                        { idempotencyKey: { $regex: escapeRegex(cleanSearch), $options: "i" } }
                    ]
                };
            }
        }

        const total = await transactionModel.countDocuments(filter);
        const transactions = await transactionModel
            .find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const formattedTransactions = transactions.map(tx => {
            const isFromUser = userAccountIdSet.has(tx.fromAccount.toString());
            const isToUser = userAccountIdSet.has(tx.toAccount.toString());

            let direction = "TRANSFER";
            let counterparty = tx.toAccount.toString();

            if (isFromUser && isToUser) {
                direction = "SELF";
                counterparty = tx.toAccount.toString();
            } else if (isFromUser) {
                direction = "DEBIT";
                counterparty = tx.toAccount.toString();
            } else if (isToUser) {
                direction = "CREDIT";
                counterparty = tx.fromAccount.toString();
            }

            return {
                ...serializeTransaction(tx),
                direction,
                counterparty
            };
        });

        return res.status(200).json({
            transactions: formattedTransactions,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) {
        console.error("Error retrieving transaction history:", err.message);
        return res.status(500).json({
            message: "Failed to retrieve transaction history"
        });
    }
}

/**
 * - POST /api/transactions/system/initial-funds
 *
 * INTENTIONALLY DISABLED — returns 501 Not Implemented.
 *
 * The previous implementation debited a system user's own account and credited a recipient
 * (which is a transfer, not fund minting). Until a deliberate, auditable treasury/source-account
 * design is implemented, this route remains disabled.
 *
 * Security checks preserved:
 * 1. authSystemUserMiddleware verifies JWT + user.systemUser === true before this handler.
 * 2. Constant-time SHA-256 + crypto.timingSafeEqual check validates x-system-admin-key against SYSTEM_ADMIN_KEY.
 */
async function createInitialFundsTransaction(req, res) {
    if (!req.user || req.user.systemUser !== true) {
        return res.status(403).json({
            message: "Forbidden access, not a system user"
        });
    }

    const systemAdminKey = process.env.SYSTEM_ADMIN_KEY;
    const providedKey = req.headers["x-system-admin-key"];

    if (!safeCompareSecrets(systemAdminKey, providedKey)) {
        return res.status(403).json({
            message: "Forbidden: system authorization key is invalid or not configured"
        });
    }

    return res.status(501).json({
        message:
            "System initial funds endpoint is disabled. An auditable treasury/source-account design is required before enabling initial fund issuance."
    });
}

module.exports = {
    createTransaction,
    getTransactionHistory,
    createInitialFundsTransaction
};
