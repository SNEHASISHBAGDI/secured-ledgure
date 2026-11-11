const request = require("supertest");
const mongoose = require("mongoose");

const app = require("../src/app");
const accountModel = require("../src/models/account.model");
const transactionModel = require("../src/models/transaction.model");
const ledgerModel = require("../src/models/ledger.model");
const emailService = require("../src/services/email.service");
const {
    MIN_AMOUNT_PAISE,
    MAX_AMOUNT_PAISE,
    isValidSafePaiseInteger,
    validatePaiseAmount,
    formatPaiseToRupees
} = require("../src/utils/monetary");
const {
    generateUniqueIdempotencyKey,
    registerTestUser,
    createAccountForToken,
    seedAccountBalance,
    seedBalancedFromTreasury,
    getAccountBalanceFromDb,
    getAccountLedgerEntries,
    performTransfer
} = require("./helpers");

describe("Transactions, Double-Entry Ledger Integrity & Concurrency", () => {
    describe("Basic Valid Transfers & Persistence", () => {
        test("executes a valid transfer, updates derived balances, creates COMPLETED transaction + DEBIT/CREDIT ledger entries", async () => {
            const userA = await registerTestUser({ email: "sender-a@example.com" });
            const userB = await registerTestUser({ email: "receiver-b@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;

            await seedAccountBalance(accA, 100000); // ₹1,000.00

            const transferRes = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: accB,
                amount: 25050 // ₹250.50
            });

            expect(transferRes.status).toBe(201);
            expect(transferRes.body.transaction).toBeDefined();
            const tx = transferRes.body.transaction;
            expect(tx.fromAccount).toBe(accA);
            expect(tx.toAccount).toBe(accB);
            expect(tx.amount).toBe(25050);
            expect(tx.unit).toBe("PAISE");
            expect(tx.status).toBe("COMPLETED");
            expect(tx.idempotencyKey).toBeUndefined();

            // Allow asynchronous setImmediate email notification callback to run deterministically
            await new Promise((resolve) => setImmediate(resolve));
            expect(emailService.sendTransactionEmail).toHaveBeenCalledTimes(1);

            // Inspect real database state (not just HTTP response)
            const dbTx = await transactionModel.findById(tx._id);
            expect(dbTx).not.toBeNull();
            expect(dbTx.fromAccount.toString()).toBe(accA);
            expect(dbTx.toAccount.toString()).toBe(accB);
            expect(dbTx.amount).toBe(25050);
            expect(dbTx.status).toBe("COMPLETED");

            const txLedgers = await ledgerModel.find({ transaction: tx._id }).lean();
            expect(txLedgers).toHaveLength(2);
            const debitEntry = txLedgers.find((l) => l.type === "DEBIT");
            const creditEntry = txLedgers.find((l) => l.type === "CREDIT");
            expect(debitEntry).toBeDefined();
            expect(creditEntry).toBeDefined();
            expect(debitEntry.account.toString()).toBe(accA);
            expect(debitEntry.amount).toBe(25050);
            expect(creditEntry.account.toString()).toBe(accB);
            expect(creditEntry.amount).toBe(25050);

            expect(await getAccountBalanceFromDb(accA)).toBe(74950);
            expect(await getAccountBalanceFromDb(accB)).toBe(25050);
        });

        test("persists committed transaction and derived balances across MongoDB disconnect and reconnect", async () => {
            const userA = await registerTestUser({ email: "persist-a@example.com" });
            const userB = await registerTestUser({ email: "persist-b@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            await seedAccountBalance(accA, 50000);

            const res = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: accB,
                amount: 12500
            });
            expect(res.status).toBe(201);
            const txId = res.body.transaction._id;

            // Disconnect and reconnect Mongoose to prove durability in MongoMemoryReplSet
            await mongoose.disconnect();
            expect(mongoose.connection.readyState).toBe(0);
            await mongoose.connect(process.env.MONGO_URI);
            expect(mongoose.connection.readyState).toBe(1);

            const persistedTx = await transactionModel.findById(txId);
            expect(persistedTx).not.toBeNull();
            expect(persistedTx.status).toBe("COMPLETED");
            expect(persistedTx.amount).toBe(12500);

            const persistedLedgers = await ledgerModel.find({ transaction: txId });
            expect(persistedLedgers).toHaveLength(2);

            expect(await getAccountBalanceFromDb(accA)).toBe(37500);
            expect(await getAccountBalanceFromDb(accB)).toBe(12500);
        });
    });

    describe("Double-Entry Invariant, Balance Conservation & Multi-Transfer Reconciliation", () => {
        test("maintains TOTAL DEBITS === TOTAL CREDITS and conserves total funds across multiple transfers", async () => {
            const treasuryUser = await registerTestUser({ email: "treasury@example.com" });
            const userA = await registerTestUser({ email: "recon-a@example.com" });
            const userB = await registerTestUser({ email: "recon-b@example.com" });
            const userC = await registerTestUser({ email: "recon-c@example.com" });

            const treasuryAcc = (await createAccountForToken(treasuryUser.token)).body.account._id;
            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            const accC = (await createAccountForToken(userC.token)).body.account._id;

            // Seed A = 100000, B = 50000, C = 0 via balanced double-entry funding from treasuryAcc
            await seedBalancedFromTreasury(treasuryAcc, accA, 100000);
            await seedBalancedFromTreasury(treasuryAcc, accB, 50000);

            const totalUserFundsBefore =
                (await getAccountBalanceFromDb(accA)) +
                (await getAccountBalanceFromDb(accB)) +
                (await getAccountBalanceFromDb(accC));
            expect(totalUserFundsBefore).toBe(150000);

            // Execute chain of transfers: A->B (25000), B->C (30000), C->A (10000), A->C (15050)
            const transfers = [
                { token: userA.token, fromAccount: accA, toAccount: accB, amount: 25000 },
                { token: userB.token, fromAccount: accB, toAccount: accC, amount: 30000 },
                { token: userC.token, fromAccount: accC, toAccount: accA, amount: 10000 },
                { token: userA.token, fromAccount: accA, toAccount: accC, amount: 15050 }
            ];

            for (const tr of transfers) {
                const res = await performTransfer(tr.token, tr);
                expect(res.status).toBe(201);
            }

            const balA = await getAccountBalanceFromDb(accA);
            const balB = await getAccountBalanceFromDb(accB);
            const balC = await getAccountBalanceFromDb(accC);

            expect(balA).toBe(69950); // 100000 - 25000 + 10000 - 15050
            expect(balB).toBe(45000); // 50000 + 25000 - 30000
            expect(balC).toBe(35050); // 0 + 30000 - 10000 + 15050
            expect(balA + balB + balC).toBe(totalUserFundsBefore);

            // Aggregate ALL debit & credit entries across the entire ledger collection
            const totals = await ledgerModel.aggregate([
                {
                    $group: {
                        _id: "$type",
                        total: { $sum: "$amount" }
                    }
                }
            ]);

            const totalDebit = totals.find((t) => t._id === "DEBIT")?.total ?? 0;
            const totalCredit = totals.find((t) => t._id === "CREDIT")?.total ?? 0;
            expect(totalDebit).toBe(totalCredit);
            // 150000 balanced treasury seed + 80050 transfers = 230050
            expect(totalDebit).toBe(230050);
        });
    });

    describe("Insufficient Balance & Validation Guardrails (Zero Partial State)", () => {
        test("rejects transfer exceeding available balance with 400 and writes zero transaction/ledger rows", async () => {
            const userA = await registerTestUser({ email: "insuff-a@example.com" });
            const userB = await registerTestUser({ email: "insuff-b@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            await seedAccountBalance(accA, 10000);

            const res = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: accB,
                amount: 25000
            });

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/insufficient balance/i);
            expect(await getAccountBalanceFromDb(accA)).toBe(10000);
            expect(await getAccountBalanceFromDb(accB)).toBe(0);
            expect(await transactionModel.countDocuments({})).toBe(0);
            expect(await ledgerModel.countDocuments({})).toBe(1); // Only initial seed entry
        });

        test("rejects zero, negative, float, malformed numeric strings, and over-limit amounts with 400 and no DB mutations", async () => {
            const userA = await registerTestUser({ email: "amt-a@example.com" });
            const userB = await registerTestUser({ email: "amt-b@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            await seedAccountBalance(accA, 50000);

            const invalidAmounts = [
                0,
                -1,
                -25000,
                "0",
                "-100",
                "+100",
                "abc",
                100.5,
                "100.50",
                "1e5",
                "0100",
                " 100 ",
                "100px",
                MAX_AMOUNT_PAISE + 1,
                Number.MAX_SAFE_INTEGER + 1,
                true,
                [100],
                { value: 100 }
            ];

            for (const badAmount of invalidAmounts) {
                const res = await performTransfer(userA.token, {
                    fromAccount: accA,
                    toAccount: accB,
                    amount: badAmount
                });
                expect(res.status).toBe(400);
            }

            expect(await getAccountBalanceFromDb(accA)).toBe(50000);
            expect(await getAccountBalanceFromDb(accB)).toBe(0);
            expect(await transactionModel.countDocuments({})).toBe(0);
            expect(await ledgerModel.countDocuments({})).toBe(1);
        });

        test("rejects self-transfer (same source and destination account) with 400 and leaves balance unchanged", async () => {
            const userA = await registerTestUser({ email: "self@example.com" });
            const accA = (await createAccountForToken(userA.token)).body.account._id;
            await seedAccountBalance(accA, 50000);

            const res = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: accA,
                amount: 10000
            });

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/must be different/i);
            expect(await getAccountBalanceFromDb(accA)).toBe(50000);
            expect(await transactionModel.countDocuments({})).toBe(0);
            expect(await ledgerModel.countDocuments({})).toBe(1);
        });

        test("rejects non-string and malformed idempotencyKey values with 400 and leaves zero DB mutations", async () => {
            const userA = await registerTestUser({ email: "idemkey-a@example.com" });
            const userB = await registerTestUser({ email: "idemkey-b@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            await seedAccountBalance(accA, 50000);

            const invalidKeys = [
                12345678,
                ["tx-key-valid-1234"],
                { $ne: "" },
                true,
                "short",
                "bad key with spaces!",
                "k".repeat(129)
            ];

            for (const badKey of invalidKeys) {
                const res = await performTransfer(userA.token, {
                    fromAccount: accA,
                    toAccount: accB,
                    amount: 1000,
                    idempotencyKey: badKey
                });
                expect(res.status).toBe(400);
                expect(res.body.message).toMatch(/idempotencyKey/i);
            }

            expect(await getAccountBalanceFromDb(accA)).toBe(50000);
            expect(await transactionModel.countDocuments({})).toBe(0);
            expect(await ledgerModel.countDocuments({})).toBe(1);
        });
    });

    describe("Invalid Source/Destination Accounts & Ownership / IDOR Protection", () => {
        test("rejects missing, malformed, nonexistent, and inactive source accounts without partial mutations", async () => {
            const userA = await registerTestUser({ email: "src-a@example.com" });
            const userB = await registerTestUser({ email: "src-b@example.com" });
            const accB = (await createAccountForToken(userB.token)).body.account._id;

            // Missing fromAccount
            const missingSrc = await request(app)
                .post("/api/transactions/")
                .set("Authorization", `Bearer ${userA.token}`)
                .send({
                    toAccount: accB,
                    amount: 500,
                    idempotencyKey: generateUniqueIdempotencyKey()
                });
            expect(missingSrc.status).toBe(400);

            // Malformed fromAccount
            const malformedSrc = await performTransfer(userA.token, {
                fromAccount: "not-a-valid-id",
                toAccount: accB,
                amount: 500
            });
            expect(malformedSrc.status).toBe(400);

            // Nonexistent valid ObjectId fromAccount
            const missingIdSrc = await performTransfer(userA.token, {
                fromAccount: new mongoose.Types.ObjectId().toString(),
                toAccount: accB,
                amount: 500
            });
            expect(missingIdSrc.status).toBe(404);

            // Inactive (FROZEN) source account owned by userA
            const frozenSrc = await accountModel.create({
                user: userA.user._id,
                status: "FROZEN",
                currency: "INR"
            });
            await seedAccountBalance(frozenSrc._id, 50000);

            const frozenRes = await performTransfer(userA.token, {
                fromAccount: frozenSrc._id.toString(),
                toAccount: accB,
                amount: 1000
            });
            expect(frozenRes.status).toBe(400);
            expect(await getAccountBalanceFromDb(frozenSrc._id)).toBe(50000);
            expect(await getAccountBalanceFromDb(accB)).toBe(0);
            expect(await transactionModel.countDocuments({})).toBe(0);
            expect(await ledgerModel.countDocuments({})).toBe(1);
        });

        test("rejects missing, malformed, nonexistent, inactive, and currency-mismatched destination accounts", async () => {
            const userA = await registerTestUser({ email: "dst-a@example.com" });
            const userB = await registerTestUser({ email: "dst-b@example.com" });
            const accA = (await createAccountForToken(userA.token)).body.account._id;
            await seedAccountBalance(accA, 50000);

            // Missing toAccount
            const missingDst = await request(app)
                .post("/api/transactions/")
                .set("Authorization", `Bearer ${userA.token}`)
                .send({
                    fromAccount: accA,
                    amount: 500,
                    idempotencyKey: generateUniqueIdempotencyKey()
                });
            expect(missingDst.status).toBe(400);

            // Malformed toAccount
            const malformedDst = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: "bad-id-123",
                amount: 500
            });
            expect(malformedDst.status).toBe(400);

            // Nonexistent toAccount
            const unknownDst = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: new mongoose.Types.ObjectId().toString(),
                amount: 500
            });
            expect(unknownDst.status).toBe(404);

            // Inactive (CLOSED) destination account
            const closedDst = await accountModel.create({
                user: userB.user._id,
                status: "CLOSED",
                currency: "INR"
            });
            const closedRes = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: closedDst._id.toString(),
                amount: 500
            });
            expect(closedRes.status).toBe(404);

            // Mismatched currency destination account (USD vs INR)
            const usdDst = await accountModel.create({
                user: userB.user._id,
                status: "ACTIVE",
                currency: "USD"
            });
            const currencyRes = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: usdDst._id.toString(),
                amount: 500
            });
            expect(currencyRes.status).toBe(400);
            expect(currencyRes.body.message).toMatch(/currency mismatch/i);

            expect(await getAccountBalanceFromDb(accA)).toBe(50000);
            expect(await transactionModel.countDocuments({})).toBe(0);
            expect(await ledgerModel.countDocuments({})).toBe(1);
        });

        test("prevents IDOR transfers from another user's account in both directions", async () => {
            const userA = await registerTestUser({ email: "idor-a@example.com" });
            const userB = await registerTestUser({ email: "idor-b@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;

            await seedAccountBalance(accA, 40000);
            await seedAccountBalance(accB, 60000);

            // User A tries to debit User B's account into User A's account
            const aStealsFromB = await performTransfer(userA.token, {
                fromAccount: accB,
                toAccount: accA,
                amount: 10000
            });
            expect(aStealsFromB.status).toBe(404);

            // Reverse: User B tries to debit User A's account into User B's account
            const bStealsFromA = await performTransfer(userB.token, {
                fromAccount: accA,
                toAccount: accB,
                amount: 10000
            });
            expect(bStealsFromA.status).toBe(404);

            expect(await getAccountBalanceFromDb(accA)).toBe(40000);
            expect(await getAccountBalanceFromDb(accB)).toBe(60000);
            expect(await transactionModel.countDocuments({})).toBe(0);
            expect(await ledgerModel.countDocuments({})).toBe(2);
        });
    });

    describe("Atomicity & Controlled MongoDB Transaction Rollback", () => {
        test("aborts MongoDB transaction and leaves zero partial ledger/transaction writes when CREDIT creation fails after DEBIT", async () => {
            const userA = await registerTestUser({ email: "rb-credit-a@example.com" });
            const userB = await registerTestUser({ email: "rb-credit-b@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            await seedAccountBalance(accA, 80000);

            const origLedgerCreate = ledgerModel.create.bind(ledgerModel);
            let ledgerCreateCalls = 0;
            const ledgerCreateSpy = jest
                .spyOn(ledgerModel, "create")
                .mockImplementation(async (docs, options) => {
                    ledgerCreateCalls += 1;
                    // First call is DEBIT (succeeds inside session); second call is CREDIT (fails before commit)
                    if (ledgerCreateCalls === 2) {
                        throw new Error("Simulated failure before CREDIT ledger entry");
                    }
                    return origLedgerCreate(docs, options);
                });

            try {
                const res = await performTransfer(userA.token, {
                    fromAccount: accA,
                    toAccount: accB,
                    amount: 20000
                });

                expect(res.status).toBe(500);
                expect(ledgerCreateCalls).toBe(2);
            } finally {
                ledgerCreateSpy.mockRestore();
            }

            // Verify full rollback in real MongoMemoryReplSet
            expect(await getAccountBalanceFromDb(accA)).toBe(80000);
            expect(await getAccountBalanceFromDb(accB)).toBe(0);
            expect(await transactionModel.countDocuments({})).toBe(0);
            expect(await ledgerModel.countDocuments({})).toBe(1); // Only the seed entry remains
        });

        test("aborts MongoDB transaction when status save to COMPLETED fails after both DEBIT and CREDIT entries", async () => {
            const userA = await registerTestUser({ email: "rb-save-a@example.com" });
            const userB = await registerTestUser({ email: "rb-save-b@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            await seedAccountBalance(accA, 90000);

            const txSaveSpy = jest
                .spyOn(transactionModel.prototype, "save")
                .mockRejectedValueOnce(new Error("Simulated failure before commitTransaction"));

            try {
                const res = await performTransfer(userA.token, {
                    fromAccount: accA,
                    toAccount: accB,
                    amount: 35000
                });

                expect(res.status).toBe(500);
                expect(txSaveSpy).toHaveBeenCalledTimes(1);
            } finally {
                txSaveSpy.mockRestore();
            }

            expect(await getAccountBalanceFromDb(accA)).toBe(90000);
            expect(await getAccountBalanceFromDb(accB)).toBe(0);
            expect(await transactionModel.countDocuments({})).toBe(0);
            expect(await ledgerModel.countDocuments({})).toBe(1);
        });
    });

    describe("Concurrent Transfers & Balance Protection", () => {
        test("prevents negative balance / overspending across 5 concurrent 30000-paise transfers from 100000 balance", async () => {
            const userA = await registerTestUser({ email: "conc-over-a@example.com" });
            const userB = await registerTestUser({ email: "conc-over-b@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            await seedAccountBalance(accA, 100000);

            const requests = Array.from({ length: 5 }, (_, idx) =>
                performTransfer(userA.token, {
                    fromAccount: accA,
                    toAccount: accB,
                    amount: 30000,
                    idempotencyKey: generateUniqueIdempotencyKey(`conc-over-${idx}`)
                })
            );

            const responses = await Promise.all(requests);
            const succeeded = responses.filter((r) => r.status === 201);
            const statusCounts = responses.reduce((acc, r) => {
                acc[r.status] = (acc[r.status] || 0) + 1;
                return acc;
            }, {});

            // Record actual status distribution in test output for empirical audit visibility
            console.info("[CONCURRENCY_OVERSPEND_OBSERVED]", statusCounts);

            // At least one transfer succeeds, and never more than 3 (3 * 30000 <= 100000)
            expect(succeeded.length).toBeGreaterThanOrEqual(1);
            expect(succeeded.length).toBeLessThanOrEqual(3);
            expect(responses.every((r) => [201, 400, 409].includes(r.status))).toBe(true);

            const finalA = await getAccountBalanceFromDb(accA);
            const finalB = await getAccountBalanceFromDb(accB);

            expect(finalA).toBeGreaterThanOrEqual(0);
            expect(finalA).toBe(100000 - succeeded.length * 30000);
            expect(finalB).toBe(succeeded.length * 30000);
            expect(finalA + finalB).toBe(100000);

            const completedTxs = await transactionModel.find({ status: "COMPLETED" }).lean();
            expect(completedTxs).toHaveLength(succeeded.length);

            const txIds = completedTxs.map((t) => t._id);
            const transferLedgers = await ledgerModel.find({ transaction: { $in: txIds } }).lean();
            expect(transferLedgers).toHaveLength(succeeded.length * 2);

            const totalDebits = transferLedgers
                .filter((l) => l.type === "DEBIT")
                .reduce((sum, l) => sum + l.amount, 0);
            const totalCredits = transferLedgers
                .filter((l) => l.type === "CREDIT")
                .reduce((sum, l) => sum + l.amount, 0);
            expect(totalDebits).toBe(succeeded.length * 30000);
            expect(totalCredits).toBe(totalDebits);
        });

        test("evaluates 5 concurrent valid 10000-paise transfers from 100000 balance (strict success + ledger invariants)", async () => {
            const userA = await registerTestUser({ email: "conc-valid-a@example.com" });
            const userB = await registerTestUser({ email: "conc-valid-b@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            await seedAccountBalance(accA, 100000);

            const requests = Array.from({ length: 5 }, (_, idx) =>
                performTransfer(userA.token, {
                    fromAccount: accA,
                    toAccount: accB,
                    amount: 10000,
                    idempotencyKey: generateUniqueIdempotencyKey(`conc-valid-${idx}`)
                })
            );

            const responses = await Promise.all(requests);
            const succeeded = responses.filter((r) => r.status === 201);
            const statusCounts = responses.reduce((acc, r) => {
                acc[r.status] = (acc[r.status] || 0) + 1;
                return acc;
            }, {});
            console.info("[CONCURRENCY_VALID_5X10K_OBSERVED]", statusCounts);

            // Invariants must always hold regardless of WriteConflict 409 behavior
            const finalA = await getAccountBalanceFromDb(accA);
            const finalB = await getAccountBalanceFromDb(accB);
            expect(finalA).toBe(100000 - succeeded.length * 10000);
            expect(finalB).toBe(succeeded.length * 10000);
            expect(finalA + finalB).toBe(100000);

            const completedTxs = await transactionModel.find({ status: "COMPLETED" }).lean();
            expect(completedTxs).toHaveLength(succeeded.length);

            // Strict expectation per Phase 3 spec: all 5 concurrent valid transfers succeed
            // (If MongoDB WriteConflict returns 409 without server retry, this exposes it cleanly.)
            expect(succeeded).toHaveLength(5);
            expect(finalA).toBe(50000);
            expect(finalB).toBe(50000);
        });
    });

    describe("Ledger & Transaction Immutability", () => {
        test("ledger entries reject Mongoose update and delete operations via immutability hooks", async () => {
            const userA = await registerTestUser({ email: "immut-a@example.com" });
            const userB = await registerTestUser({ email: "immut-b@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            await seedAccountBalance(accA, 30000);

            const transferRes = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: accB,
                amount: 10000
            });
            expect(transferRes.status).toBe(201);

            const entry = await ledgerModel.findOne({ transaction: transferRes.body.transaction._id });
            expect(entry).not.toBeNull();

            await expect(
                ledgerModel.updateOne({ _id: entry._id }, { $set: { amount: 99999 } })
            ).rejects.toThrow(/immutable/i);

            await expect(
                ledgerModel.findOneAndUpdate({ _id: entry._id }, { $set: { amount: 99999 } })
            ).rejects.toThrow(/immutable/i);

            await expect(ledgerModel.deleteOne({ _id: entry._id })).rejects.toThrow(/immutable/i);
            await expect(ledgerModel.findOneAndDelete({ _id: entry._id })).rejects.toThrow(/immutable/i);
            await expect(ledgerModel.deleteMany({ _id: entry._id })).rejects.toThrow(/immutable/i);
            await expect(ledgerModel.updateMany({ _id: entry._id }, { $set: { type: "CREDIT" } })).rejects.toThrow(
                /immutable/i
            );
            await expect(
                ledgerModel.findOneAndReplace({ _id: entry._id }, { amount: 1 })
            ).rejects.toThrow(/immutable/i);

            // Confirm persisted entry remained completely unaltered
            const reloaded = await ledgerModel.findById(entry._id);
            expect(reloaded.amount).toBe(10000);
        });

        test("documents TransactionModel schema behavior: enforces amount/enum bounds while allowing ODM updates (no immutability hooks)", async () => {
            const acc1 = new mongoose.Types.ObjectId();
            const acc2 = new mongoose.Types.ObjectId();

            const tx = await transactionModel.create({
                fromAccount: acc1,
                toAccount: acc2,
                amount: 5000,
                idempotencyKey: generateUniqueIdempotencyKey("tx-immut-check"),
                status: "COMPLETED"
            });

            // Schema rejects invalid enum status and non-safe-integer amounts
            const badAmountTx = new transactionModel({
                fromAccount: acc1,
                toAccount: acc2,
                amount: 10.5,
                idempotencyKey: generateUniqueIdempotencyKey("tx-bad-amt")
            });
            expect(badAmountTx.validateSync().errors.amount).toBeDefined();

            // Actual behavior: transactionSchema defines no immutability pre-hooks because
            // createTransaction mutates status from PENDING -> COMPLETED via save().
            const updated = await transactionModel.findOneAndUpdate(
                { _id: tx._id },
                { $set: { amount: 7777 } },
                { new: true }
            );
            expect(updated.amount).toBe(7777);
        });
    });

    describe("GET /api/transactions/ — Transaction History, Pagination, Filtering & Isolation", () => {
        test("requires authentication (401)", async () => {
            const res = await request(app).get("/api/transactions/");
            expect(res.status).toBe(401);
        });

        test("isolates history per user, annotates CREDIT/DEBIT directions cleanly, and omits idempotencyKey", async () => {
            const userA = await registerTestUser({ email: "hist-a@example.com" });
            const userB = await registerTestUser({ email: "hist-b@example.com" });
            const userC = await registerTestUser({ email: "hist-c@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            const accC = (await createAccountForToken(userC.token)).body.account._id;

            await seedAccountBalance(accA, 50000);
            await seedAccountBalance(accB, 50000);

            // Transfer A -> B (visible to A as DEBIT, B as CREDIT, NOT visible to C)
            const keyAB = generateUniqueIdempotencyKey("secret-ab-key");
            const txAB = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: accB,
                amount: 1500,
                idempotencyKey: keyAB
            });
            expect(txAB.status).toBe(201);

            // Transfer B -> C (NOT visible to A)
            const txBC = await performTransfer(userB.token, {
                fromAccount: accB,
                toAccount: accC,
                amount: 2000,
                idempotencyKey: generateUniqueIdempotencyKey("secret-bc-key")
            });
            expect(txBC.status).toBe(201);

            const histA = await request(app)
                .get("/api/transactions/")
                .set("Authorization", `Bearer ${userA.token}`);
            expect(histA.status).toBe(200);
            expect(histA.body.transactions).toHaveLength(1);
            expect(histA.body.transactions[0]._id).toBe(txAB.body.transaction._id);
            expect(histA.body.transactions[0].direction).toBe("DEBIT");
            expect(histA.body.transactions[0].counterparty).toBe(accB);
            expect(histA.body.transactions[0].idempotencyKey).toBeUndefined();

            const histB = await request(app)
                .get("/api/transactions/")
                .set("Authorization", `Bearer ${userB.token}`);
            expect(histB.status).toBe(200);
            expect(histB.body.transactions).toHaveLength(2);
            const receivedFromA = histB.body.transactions.find(
                (t) => t._id === txAB.body.transaction._id
            );
            expect(receivedFromA.direction).toBe("CREDIT");
            expect(receivedFromA.counterparty).toBe(accA);
            expect(receivedFromA.idempotencyKey).toBeUndefined();

            const histC = await request(app)
                .get("/api/transactions/")
                .set("Authorization", `Bearer ${userC.token}`);
            expect(histC.status).toBe(200);
            expect(histC.body.transactions).toHaveLength(1);
            expect(histC.body.transactions[0]._id).toBe(txBC.body.transaction._id);
        });

        test("paginates 12 transactions deterministically without page overlap and supports filtering & search", async () => {
            const userA = await registerTestUser({ email: "page-a@example.com" });
            const userB = await registerTestUser({ email: "page-b@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            await seedAccountBalance(accA, 200000);
            await seedAccountBalance(accB, 100000);

            // Create 10 transfers A -> B (DEBIT for A) and 2 transfers B -> A (CREDIT for A) = 12 total
            for (let i = 0; i < 10; i++) {
                const res = await performTransfer(userA.token, {
                    fromAccount: accA,
                    toAccount: accB,
                    amount: 1000 + i,
                    idempotencyKey: generateUniqueIdempotencyKey(`page-debit-${i}`)
                });
                expect(res.status).toBe(201);
            }
            for (let j = 0; j < 2; j++) {
                const res = await performTransfer(userB.token, {
                    fromAccount: accB,
                    toAccount: accA,
                    amount: 2000 + j,
                    idempotencyKey: generateUniqueIdempotencyKey(`page-credit-${j}`)
                });
                expect(res.status).toBe(201);
            }

            const p1 = await request(app)
                .get("/api/transactions/?page=1&limit=5")
                .set("Authorization", `Bearer ${userA.token}`);
            const p2 = await request(app)
                .get("/api/transactions/?page=2&limit=5")
                .set("Authorization", `Bearer ${userA.token}`);
            const p3 = await request(app)
                .get("/api/transactions/?page=3&limit=5")
                .set("Authorization", `Bearer ${userA.token}`);

            expect(p1.status).toBe(200);
            expect(p1.body.total).toBe(12);
            expect(p1.body.totalPages).toBe(3);
            expect(p1.body.transactions).toHaveLength(5);
            expect(p2.body.transactions).toHaveLength(5);
            expect(p3.body.transactions).toHaveLength(2);

            const allIds = [
                ...p1.body.transactions.map((t) => t._id),
                ...p2.body.transactions.map((t) => t._id),
                ...p3.body.transactions.map((t) => t._id)
            ];
            expect(new Set(allIds).size).toBe(12);

            // Filter by type=DEBIT vs type=CREDIT
            const debitsOnly = await request(app)
                .get("/api/transactions/?type=DEBIT&limit=50")
                .set("Authorization", `Bearer ${userA.token}`);
            expect(debitsOnly.status).toBe(200);
            expect(debitsOnly.body.total).toBe(10);
            expect(debitsOnly.body.transactions.every((t) => t.direction === "DEBIT")).toBe(true);

            const creditsOnly = await request(app)
                .get("/api/transactions/?type=CREDIT&limit=50")
                .set("Authorization", `Bearer ${userA.token}`);
            expect(creditsOnly.status).toBe(200);
            expect(creditsOnly.body.total).toBe(2);
            expect(creditsOnly.body.transactions.every((t) => t.direction === "CREDIT")).toBe(true);

            // Search by specific transaction ObjectId
            const targetTxId = p3.body.transactions[0]._id;
            const searchById = await request(app)
                .get(`/api/transactions/?search=${targetTxId}`)
                .set("Authorization", `Bearer ${userA.token}`);
            expect(searchById.status).toBe(200);
            expect(searchById.body.transactions).toHaveLength(1);
            expect(searchById.body.transactions[0]._id).toBe(targetTxId);

            // Sender cannot match sender-private key from recipient side
            const recipientProbe = await request(app)
                .get("/api/transactions/?search=page-debit-0")
                .set("Authorization", `Bearer ${userB.token}`);
            expect(recipientProbe.status).toBe(200);
            expect(recipientProbe.body.transactions).toHaveLength(0);

            // Invalid query parameter handling
            const badType = await request(app)
                .get("/api/transactions/?type=INVALID")
                .set("Authorization", `Bearer ${userA.token}`);
            expect(badType.status).toBe(400);

            const arrayType = await request(app)
                .get("/api/transactions/?type=CREDIT&type=DEBIT")
                .set("Authorization", `Bearer ${userA.token}`);
            expect(arrayType.status).toBe(400);

            const arraySearch = await request(app)
                .get("/api/transactions/?search=a&search=b")
                .set("Authorization", `Bearer ${userA.token}`);
            expect(arraySearch.status).toBe(400);
        });

        test("returns empty history for user without accounts and labels own-account transfers as SELF", async () => {
            const noAcctUser = await registerTestUser({ email: "no-acct@example.com" });
            const emptyRes = await request(app)
                .get("/api/transactions/")
                .set("Authorization", `Bearer ${noAcctUser.token}`);
            expect(emptyRes.status).toBe(200);
            expect(emptyRes.body).toEqual({
                transactions: [],
                total: 0,
                page: 1,
                totalPages: 0
            });

            const userA = await registerTestUser({ email: "self-hist@example.com" });
            const acc1 = (await createAccountForToken(userA.token)).body.account._id;
            const acc2 = (await createAccountForToken(userA.token)).body.account._id;
            await seedAccountBalance(acc1, 30000);

            const selfTransfer = await performTransfer(userA.token, {
                fromAccount: acc1,
                toAccount: acc2,
                amount: 12000
            });
            expect(selfTransfer.status).toBe(201);

            const histRes = await request(app)
                .get("/api/transactions/")
                .set("Authorization", `Bearer ${userA.token}`);
            expect(histRes.status).toBe(200);
            expect(histRes.body.transactions).toHaveLength(1);
            expect(histRes.body.transactions[0].direction).toBe("SELF");
            expect(histRes.body.transactions[0].counterparty).toBe(acc2);
            expect(await getAccountBalanceFromDb(acc1)).toBe(18000);
            expect(await getAccountBalanceFromDb(acc2)).toBe(12000);
        });

        test("returns sanitized 500 JSON when history query encounters an unexpected DB failure", async () => {
            const user = await registerTestUser({ email: "hist-err@example.com" });
            await createAccountForToken(user.token);

            const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
            const dbSpy = jest
                .spyOn(transactionModel, "countDocuments")
                .mockRejectedValueOnce(new Error("ReplicaSet primary stepped down at internal-node:27017"));

            try {
                const res = await request(app)
                    .get("/api/transactions/")
                    .set("Authorization", `Bearer ${user.token}`);
                expect(res.status).toBe(500);
                expect(res.body).toEqual({ message: "Failed to retrieve transaction history" });
                expect(JSON.stringify(res.body)).not.toMatch(/27017|ReplicaSet/i);
            } finally {
                dbSpy.mockRestore();
                errSpy.mockRestore();
            }
        });
    });

    describe("Monetary Precision (Integer Paise Unit & Integration Checks)", () => {
        test("validates exact integer paise rules, bounds, formatting, and safe integer limits in monetary.js", () => {
            expect(MIN_AMOUNT_PAISE).toBe(1);
            expect(MAX_AMOUNT_PAISE).toBe(100000000000);

            // Exact paise conversions & formatting
            expect(validatePaiseAmount(10000)).toEqual({ valid: true, minorUnits: 10000 }); // ₹100
            expect(validatePaiseAmount(25050)).toEqual({ valid: true, minorUnits: 25050 }); // ₹250.50
            expect(validatePaiseAmount("25050")).toEqual({ valid: true, minorUnits: 25050 });
            expect(validatePaiseAmount(MIN_AMOUNT_PAISE).valid).toBe(true);
            expect(validatePaiseAmount(MAX_AMOUNT_PAISE).valid).toBe(true);
            expect(validatePaiseAmount(null).valid).toBe(false);
            expect(validatePaiseAmount(undefined).valid).toBe(false);
            expect(validatePaiseAmount("").valid).toBe(false);

            expect(formatPaiseToRupees(10000)).toBe("100.00");
            expect(formatPaiseToRupees(25050)).toBe("250.50");
            expect(formatPaiseToRupees(1)).toBe("0.01");
            expect(formatPaiseToRupees(-505)).toBe("-5.05");
            expect(formatPaiseToRupees(NaN)).toBe("0.00");
            expect(formatPaiseToRupees("100")).toBe("0.00");

            // Bounds and safe-integer checks
            expect(isValidSafePaiseInteger(25050)).toBe(true);
            expect(isValidSafePaiseInteger(MAX_AMOUNT_PAISE + 1)).toBe(false);
            expect(isValidSafePaiseInteger(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
            expect(validatePaiseAmount(MAX_AMOUNT_PAISE + 1).valid).toBe(false);
            expect(validatePaiseAmount(0).valid).toBe(false);
            expect(validatePaiseAmount(-5).valid).toBe(false);
            expect(validatePaiseAmount(19.99).valid).toBe(false);
            expect(validatePaiseAmount("19.99").valid).toBe(false);
            expect(validatePaiseAmount("1e5").valid).toBe(false);
        });

        test("preserves exact integer paise sums without floating-point drift (10 + 20 === 30 paise)", async () => {
            const userA = await registerTestUser({ email: "prec-a@example.com" });
            const userB = await registerTestUser({ email: "prec-b@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            await seedAccountBalance(accA, 1000);

            expect((await performTransfer(userA.token, { fromAccount: accA, toAccount: accB, amount: 10 })).status).toBe(201);
            expect((await performTransfer(userA.token, { fromAccount: accA, toAccount: accB, amount: 20 })).status).toBe(201);

            const entriesB = await getAccountLedgerEntries(accB);
            expect(entriesB).toHaveLength(2);
            const finalA = await getAccountBalanceFromDb(accA);
            const finalB = await getAccountBalanceFromDb(accB);

            expect(Number.isSafeInteger(finalA)).toBe(true);
            expect(Number.isSafeInteger(finalB)).toBe(true);
            expect(finalA).toBe(970);
            expect(finalB).toBe(30);
        });
    });
});
