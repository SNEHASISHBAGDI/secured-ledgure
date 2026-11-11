const request = require("supertest");
const mongoose = require("mongoose");

const app = require("../src/app");
const accountModel = require("../src/models/account.model");
const transactionModel = require("../src/models/transaction.model");
const ledgerModel = require("../src/models/ledger.model");
const {
    generateUniqueIdempotencyKey,
    registerTestUser,
    createAccountForToken,
    seedAccountBalance,
    getAccountBalanceFromDb,
    getAccountLedgerEntries,
    performTransfer
} = require("./helpers");

describe("Idempotency Contract, Replay Safety & Concurrent Duplicate Handling", () => {
    describe("Basic Idempotent Replay & Replay After Success", () => {
        test("replays exact same COMPLETED transfer without creating duplicate transaction, ledger rows, or balance mutation", async () => {
            const userA = await registerTestUser({ email: "idem-replay-a@example.com" });
            const userB = await registerTestUser({ email: "idem-replay-b@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            await seedAccountBalance(accA, 100000);

            const key = generateUniqueIdempotencyKey("replay-basic");

            expect(await transactionModel.countDocuments({ idempotencyKey: key })).toBe(0);

            // First execution
            const firstRes = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: accB,
                amount: 25000,
                idempotencyKey: key
            });

            expect(firstRes.status).toBe(201);
            expect(firstRes.body.transaction.status).toBe("COMPLETED");
            expect(firstRes.body.transaction.amount).toBe(25000);
            expect(firstRes.body.transaction.idempotencyKey).toBeUndefined();

            // Exact replay with same user, same payload, same idempotencyKey
            const replayRes = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: accB,
                amount: 25000,
                idempotencyKey: key
            });

            expect(replayRes.status).toBe(200);
            expect(replayRes.body.message).toMatch(/already processed/i);
            expect(replayRes.body.transaction._id).toBe(firstRes.body.transaction._id);
            expect(replayRes.body.transaction.fromAccount).toBe(accA);
            expect(replayRes.body.transaction.toAccount).toBe(accB);
            expect(replayRes.body.transaction.amount).toBe(25000);
            expect(replayRes.body.transaction.unit).toBe("PAISE");
            expect(replayRes.body.transaction.status).toBe("COMPLETED");
            expect(replayRes.body.transaction.idempotencyKey).toBeUndefined();

            // Third replay still produces identical state
            const secondReplayRes = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: accB,
                amount: 25000,
                idempotencyKey: key
            });
            expect(secondReplayRes.status).toBe(200);
            expect(secondReplayRes.body.transaction._id).toBe(firstRes.body.transaction._id);

            // Direct MongoDB assertions
            const txs = await transactionModel.find({ idempotencyKey: key }).lean();
            expect(txs).toHaveLength(1);
            expect(txs[0].status).toBe("COMPLETED");

            const ledgers = await ledgerModel.find({ transaction: txs[0]._id }).lean();
            expect(ledgers).toHaveLength(2);
            expect(ledgers.filter((l) => l.type === "DEBIT")).toHaveLength(1);
            expect(ledgers.filter((l) => l.type === "CREDIT")).toHaveLength(1);

            expect(await getAccountBalanceFromDb(accA)).toBe(75000);
            expect(await getAccountBalanceFromDb(accB)).toBe(25000);
        });
    });

    describe("Same Key + Payload Mismatch Protection", () => {
        test("rejects key reuse when amount differs (10000 -> 20000) with 409 and preserves original financial state", async () => {
            const userA = await registerTestUser({ email: "idem-amt-a@example.com" });
            const userB = await registerTestUser({ email: "idem-amt-b@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            await seedAccountBalance(accA, 100000);

            const key = generateUniqueIdempotencyKey("mismatch-amount");

            const firstRes = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: accB,
                amount: 10000,
                idempotencyKey: key
            });
            expect(firstRes.status).toBe(201);

            const mismatchRes = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: accB,
                amount: 20000,
                idempotencyKey: key
            });

            expect(mismatchRes.status).toBe(409);
            expect(mismatchRes.body.transaction).toBeUndefined();

            const txs = await transactionModel.find({ idempotencyKey: key }).lean();
            expect(txs).toHaveLength(1);
            expect(txs[0].amount).toBe(10000);

            expect(await ledgerModel.find({ transaction: txs[0]._id }).lean()).toHaveLength(2);
            expect(await getAccountBalanceFromDb(accA)).toBe(90000);
            expect(await getAccountBalanceFromDb(accB)).toBe(10000);
        });

        test("rejects key reuse when destination differs (A -> B vs A -> C) with 409 and zero unintended mutation", async () => {
            const userA = await registerTestUser({ email: "idem-dst-a@example.com" });
            const userB = await registerTestUser({ email: "idem-dst-b@example.com" });
            const userC = await registerTestUser({ email: "idem-dst-c@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            const accC = (await createAccountForToken(userC.token)).body.account._id;
            await seedAccountBalance(accA, 100000);

            const key = generateUniqueIdempotencyKey("mismatch-dest");

            const firstRes = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: accB,
                amount: 15000,
                idempotencyKey: key
            });
            expect(firstRes.status).toBe(201);

            const mismatchRes = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: accC,
                amount: 15000,
                idempotencyKey: key
            });

            expect(mismatchRes.status).toBe(409);
            expect(mismatchRes.body.transaction).toBeUndefined();

            expect(await transactionModel.countDocuments({})).toBe(1);
            expect(await ledgerModel.countDocuments({ transaction: firstRes.body.transaction._id })).toBe(2);
            expect(await getAccountBalanceFromDb(accA)).toBe(85000);
            expect(await getAccountBalanceFromDb(accB)).toBe(15000);
            expect(await getAccountBalanceFromDb(accC)).toBe(0);
        });

        test("rejects key reuse when source differs (A -> B vs C -> B) for same user with 409 and preserves DB state", async () => {
            const userA = await registerTestUser({ email: "idem-src-a@example.com" });
            const userB = await registerTestUser({ email: "idem-src-b@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accC = (await createAccountForToken(userA.token)).body.account._id; // Second account owned by userA
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            await seedAccountBalance(accA, 50000);
            await seedAccountBalance(accC, 50000);

            const key = generateUniqueIdempotencyKey("mismatch-source");

            const firstRes = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: accB,
                amount: 12000,
                idempotencyKey: key
            });
            expect(firstRes.status).toBe(201);

            const mismatchRes = await performTransfer(userA.token, {
                fromAccount: accC,
                toAccount: accB,
                amount: 12000,
                idempotencyKey: key
            });

            expect(mismatchRes.status).toBe(409);
            expect(mismatchRes.body.transaction).toBeUndefined();

            expect(await transactionModel.countDocuments({})).toBe(1);
            expect(await getAccountBalanceFromDb(accA)).toBe(38000);
            expect(await getAccountBalanceFromDb(accC)).toBe(50000);
            expect(await getAccountBalanceFromDb(accB)).toBe(12000);
        });
    });

    describe("Cross-User Collision & Authentication Ordering", () => {
        test("prevents cross-user idempotency key collision without disclosing User A's transaction details", async () => {
            const userA = await registerTestUser({ email: "cross-a@example.com" });
            const userB = await registerTestUser({ email: "cross-b@example.com" });
            const userC = await registerTestUser({ email: "cross-c@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            const accC = (await createAccountForToken(userC.token)).body.account._id;

            await seedAccountBalance(accA, 80000);
            await seedAccountBalance(accB, 80000);

            const sharedKey = generateUniqueIdempotencyKey("cross-user-key");

            const resA = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: accC,
                amount: 20000,
                idempotencyKey: sharedKey
            });
            expect(resA.status).toBe(201);

            // User B attempts their own valid transfer using User A's key
            const resB = await performTransfer(userB.token, {
                fromAccount: accB,
                toAccount: accC,
                amount: 20000,
                idempotencyKey: sharedKey
            });

            expect(resB.status).toBe(409);
            expect(resB.body.transaction).toBeUndefined();

            expect(await transactionModel.countDocuments({})).toBe(1);
            expect(await ledgerModel.countDocuments({ transaction: resA.body.transaction._id })).toBe(2);
            expect(await getAccountBalanceFromDb(accA)).toBe(60000);
            expect(await getAccountBalanceFromDb(accB)).toBe(80000);
            expect(await getAccountBalanceFromDb(accC)).toBe(20000);
        });

        test("enforces authentication and source-account ownership BEFORE idempotency key lookup", async () => {
            const userA = await registerTestUser({ email: "authord-a@example.com" });
            const userB = await registerTestUser({ email: "authord-b@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            await seedAccountBalance(accA, 50000);

            const key = generateUniqueIdempotencyKey("auth-order-key");

            const resA = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: accB,
                amount: 10000,
                idempotencyKey: key
            });
            expect(resA.status).toBe(201);

            const txFindOneSpy = jest.spyOn(transactionModel, "findOne");

            try {
                // 1. Unauthenticated request with User A's idempotencyKey must fail at authMiddleware (401)
                const unauthRes = await request(app).post("/api/transactions/").send({
                    fromAccount: accA,
                    toAccount: accB,
                    amount: 10000,
                    idempotencyKey: key
                });
                expect(unauthRes.status).toBe(401);
                expect(unauthRes.body.transaction).toBeUndefined();
                expect(txFindOneSpy).not.toHaveBeenCalled();

                // 2. Authenticated User B referencing User A's fromAccount + User A's key must fail ownership BEFORE lookup (404)
                const unownedRes = await performTransfer(userB.token, {
                    fromAccount: accA,
                    toAccount: accB,
                    amount: 10000,
                    idempotencyKey: key
                });
                expect(unownedRes.status).toBe(404);
                expect(unownedRes.body.transaction).toBeUndefined();
                expect(txFindOneSpy).not.toHaveBeenCalled();
            } finally {
                txFindOneSpy.mockRestore();
            }

            expect(await transactionModel.countDocuments({})).toBe(1);
            expect(await getAccountBalanceFromDb(accA)).toBe(40000);
            expect(await getAccountBalanceFromDb(accB)).toBe(10000);
        });
    });

    describe("Transaction Status Replay States (PENDING, FAILED, REVERSED)", () => {
        test("handles PENDING idempotency state with 409 without creating a second transaction or ledger entry", async () => {
            const userA = await registerTestUser({ email: "pending-a@example.com" });
            const userB = await registerTestUser({ email: "pending-b@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            await seedAccountBalance(accA, 50000);

            const key = generateUniqueIdempotencyKey("state-pending");
            await transactionModel.create({
                fromAccount: accA,
                toAccount: accB,
                amount: 10000,
                idempotencyKey: key,
                status: "PENDING"
            });

            const res = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: accB,
                amount: 10000,
                idempotencyKey: key
            });

            expect(res.status).toBe(409);
            expect(res.body.message).toMatch(/currently being processed/i);
            expect(res.body.transaction).toBeUndefined();

            expect(await transactionModel.countDocuments({ idempotencyKey: key })).toBe(1);
            expect(await getAccountBalanceFromDb(accA)).toBe(50000);
            expect(await getAccountBalanceFromDb(accB)).toBe(0);
        });

        test("handles FAILED idempotency state with 409 and performs no duplicate financial mutation", async () => {
            const userA = await registerTestUser({ email: "failed-a@example.com" });
            const userB = await registerTestUser({ email: "failed-b@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            await seedAccountBalance(accA, 50000);

            const key = generateUniqueIdempotencyKey("state-failed");
            await transactionModel.create({
                fromAccount: accA,
                toAccount: accB,
                amount: 10000,
                idempotencyKey: key,
                status: "FAILED"
            });

            const res = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: accB,
                amount: 10000,
                idempotencyKey: key
            });

            expect(res.status).toBe(409);
            expect(res.body.message).toMatch(/previous transfer attempt.*failed/i);
            expect(res.body.transaction).toBeUndefined();

            expect(await transactionModel.countDocuments({ idempotencyKey: key })).toBe(1);
            expect(await getAccountBalanceFromDb(accA)).toBe(50000);
            expect(await getAccountBalanceFromDb(accB)).toBe(0);
        });

        test("handles DB-seeded REVERSED transaction state via generic 409 conflict (no production reversal endpoint exists)", async () => {
            const userA = await registerTestUser({ email: "reversed-a@example.com" });
            const userB = await registerTestUser({ email: "reversed-b@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            await seedAccountBalance(accA, 50000);

            const key = generateUniqueIdempotencyKey("state-reversed");
            await transactionModel.create({
                fromAccount: accA,
                toAccount: accB,
                amount: 10000,
                idempotencyKey: key,
                status: "REVERSED"
            });

            const res = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: accB,
                amount: 10000,
                idempotencyKey: key
            });

            expect(res.status).toBe(409);
            expect(res.body.message).toMatch(/idempotency key conflict/i);
            expect(res.body.transaction).toBeUndefined();
            expect(await transactionModel.countDocuments({ idempotencyKey: key })).toBe(1);
            expect(await getAccountBalanceFromDb(accA)).toBe(50000);
        });
    });

    describe("Concurrent Duplicate Requests & Different Keys Under Concurrency", () => {
        test("10 concurrent identical requests with the SAME idempotencyKey execute strictly ONE financial operation", async () => {
            const userA = await registerTestUser({ email: "conc-dup-a@example.com" });
            const userB = await registerTestUser({ email: "conc-dup-b@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            await seedAccountBalance(accA, 100000);

            const sharedKey = generateUniqueIdempotencyKey("conc-same-key");

            const concurrentRequests = Array.from({ length: 10 }, () =>
                performTransfer(userA.token, {
                    fromAccount: accA,
                    toAccount: accB,
                    amount: 15000,
                    idempotencyKey: sharedKey
                })
            );

            const responses = await Promise.all(concurrentRequests);
            const statusCounts = responses.reduce((acc, r) => {
                acc[r.status] = (acc[r.status] || 0) + 1;
                return acc;
            }, {});
            console.info("[CONCURRENT_DUPLICATE_10X_OBSERVED]", statusCounts);

            // Exactly one request creates (201); remaining concurrent requests return 200 replay or 409 lock/conflict
            const createdResponses = responses.filter((r) => r.status === 201);
            expect(createdResponses).toHaveLength(1);
            expect(responses.every((r) => [200, 201, 409].includes(r.status))).toBe(true);

            // Follow-up sequential replay must return 200 referencing the single transaction
            const afterReplay = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: accB,
                amount: 15000,
                idempotencyKey: sharedKey
            });
            expect(afterReplay.status).toBe(200);
            expect(afterReplay.body.transaction._id).toBe(createdResponses[0].body.transaction._id);

            // Database-level invariants: 1 transaction, 2 ledger entries (1 DEBIT + 1 CREDIT), balance changed once
            const txs = await transactionModel.find({ idempotencyKey: sharedKey }).lean();
            expect(txs).toHaveLength(1);

            const txLedgers = await ledgerModel.find({ transaction: txs[0]._id }).lean();
            expect(txLedgers).toHaveLength(2);
            expect(txLedgers.filter((l) => l.type === "DEBIT").map((l) => l.amount)).toEqual([15000]);
            expect(txLedgers.filter((l) => l.type === "CREDIT").map((l) => l.amount)).toEqual([15000]);

            expect(await getAccountBalanceFromDb(accA)).toBe(85000);
            expect(await getAccountBalanceFromDb(accB)).toBe(15000);
        });

        test("5 concurrent transfers with DIFFERENT idempotency keys stay independent with zero duplicates", async () => {
            const userA = await registerTestUser({ email: "conc-diff-a@example.com" });
            const userB = await registerTestUser({ email: "conc-diff-b@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            await seedAccountBalance(accA, 100000);

            const keys = Array.from({ length: 5 }, (_, i) =>
                generateUniqueIdempotencyKey(`conc-independent-${i}`)
            );

            const responses = await Promise.all(
                keys.map((key) =>
                    performTransfer(userA.token, {
                        fromAccount: accA,
                        toAccount: accB,
                        amount: 10000,
                        idempotencyKey: key
                    })
                )
            );

            const created = responses.filter((r) => r.status === 201);
            expect(created.length).toBeGreaterThanOrEqual(1);
            expect(responses.every((r) => [201, 409].includes(r.status))).toBe(true);

            const completedTxs = await transactionModel.find({ status: "COMPLETED" }).lean();
            expect(completedTxs).toHaveLength(created.length);
            expect(new Set(completedTxs.map((t) => t.idempotencyKey)).size).toBe(created.length);

            const balA = await getAccountBalanceFromDb(accA);
            const balB = await getAccountBalanceFromDb(accB);
            expect(balA).toBe(100000 - created.length * 10000);
            expect(balB).toBe(created.length * 10000);
            expect(balA + balB).toBe(100000);
        });
    });

    describe("Real MongoDB Duplicate-Key (E11000) Handling & Uniqueness Enforcement", () => {
        test("handles real MongoDB E11000 when identical request wins commit after Step 7 pre-check, returning 200 replay", async () => {
            const userA = await registerTestUser({ email: "e11000-same-a@example.com" });
            const userB = await registerTestUser({ email: "e11000-same-b@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            await seedAccountBalance(accA, 100000);

            const raceKey = generateUniqueIdempotencyKey("e11000-replay");

            // Pause the first arrival right at Step 8 (toUserAccount lookup before startSession),
            // let a second identical request commit to MongoDB first, then let the first resume
            // into a fresh session so MongoDB's unique index on idempotencyKey raises real E11000.
            const origAccountFindOne = accountModel.findOne.bind(accountModel);
            let pausedOnce = false;
            const accountFindOneSpy = jest
                .spyOn(accountModel, "findOne")
                .mockImplementation((query, ...rest) => {
                    const isStep8RecipientCheck =
                        !pausedOnce &&
                        query &&
                        String(query._id) === accB &&
                        query.status === "ACTIVE" &&
                        !query.user;

                    if (isStep8RecipientCheck) {
                        pausedOnce = true;
                        return (async () => {
                            const winnerRes = await performTransfer(userA.token, {
                                fromAccount: accA,
                                toAccount: accB,
                                amount: 15000,
                                idempotencyKey: raceKey
                            });
                            expect(winnerRes.status).toBe(201);
                            return origAccountFindOne(query, ...rest);
                        })();
                    }

                    return origAccountFindOne(query, ...rest);
                });

            try {
                const loserRes = await performTransfer(userA.token, {
                    fromAccount: accA,
                    toAccount: accB,
                    amount: 15000,
                    idempotencyKey: raceKey
                });

                // Handled real MongoDB E11000 and verified owner + exact payload -> 200 replay
                expect(loserRes.status).toBe(200);
                expect(loserRes.body.transaction.amount).toBe(15000);
            } finally {
                accountFindOneSpy.mockRestore();
            }

            const txs = await transactionModel.find({ idempotencyKey: raceKey }).lean();
            expect(txs).toHaveLength(1);
            expect(await ledgerModel.find({ transaction: txs[0]._id }).lean()).toHaveLength(2);
            expect(await getAccountBalanceFromDb(accA)).toBe(85000);
            expect(await getAccountBalanceFromDb(accB)).toBe(15000);
        });

        test("handles real MongoDB E11000 with generic 409 when different user commits same idempotencyKey first (no leakage)", async () => {
            const userA = await registerTestUser({ email: "e11000-diff-a@example.com" });
            const userB = await registerTestUser({ email: "e11000-diff-b@example.com" });
            const userC = await registerTestUser({ email: "e11000-diff-c@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            const accC = (await createAccountForToken(userC.token)).body.account._id;
            await seedAccountBalance(accA, 50000);
            await seedAccountBalance(accB, 50000);

            const raceKey = generateUniqueIdempotencyKey("e11000-cross");

            // User B passes Step 7; before entering session, User A commits the same raceKey
            const origAccountFindOne = accountModel.findOne.bind(accountModel);
            let pausedOnce = false;
            const accountFindOneSpy = jest
                .spyOn(accountModel, "findOne")
                .mockImplementation((query, ...rest) => {
                    const isStep8RecipientCheck =
                        !pausedOnce &&
                        query &&
                        String(query._id) === accC &&
                        query.status === "ACTIVE" &&
                        !query.user;

                    if (isStep8RecipientCheck) {
                        pausedOnce = true;
                        return (async () => {
                            const winnerRes = await performTransfer(userA.token, {
                                fromAccount: accA,
                                toAccount: accC,
                                amount: 12000,
                                idempotencyKey: raceKey
                            });
                            expect(winnerRes.status).toBe(201);
                            return origAccountFindOne(query, ...rest);
                        })();
                    }

                    return origAccountFindOne(query, ...rest);
                });

            try {
                const loserBRes = await performTransfer(userB.token, {
                    fromAccount: accB,
                    toAccount: accC,
                    amount: 12000,
                    idempotencyKey: raceKey
                });

                expect(loserBRes.status).toBe(409);
                expect(loserBRes.body.transaction).toBeUndefined();
            } finally {
                accountFindOneSpy.mockRestore();
            }

            const txs = await transactionModel.find({ idempotencyKey: raceKey }).lean();
            expect(txs).toHaveLength(1);
            expect(txs[0].fromAccount.toString()).toBe(accA);
            expect(await getAccountBalanceFromDb(accA)).toBe(38000);
            expect(await getAccountBalanceFromDb(accB)).toBe(50000);
            expect(await getAccountBalanceFromDb(accC)).toBe(12000);
        });

        test("enforces unique index on TransactionModel.idempotencyKey directly at MongoDB level", async () => {
            const acc1 = new mongoose.Types.ObjectId();
            const acc2 = new mongoose.Types.ObjectId();
            const dupKey = generateUniqueIdempotencyKey("db-unique-idx");

            await transactionModel.create({
                fromAccount: acc1,
                toAccount: acc2,
                amount: 1000,
                idempotencyKey: dupKey,
                status: "COMPLETED"
            });

            await expect(
                transactionModel.create({
                    fromAccount: acc1,
                    toAccount: acc2,
                    amount: 1000,
                    idempotencyKey: dupKey,
                    status: "COMPLETED"
                })
            ).rejects.toMatchObject({ code: 11000 });
        });
    });

    describe("Idempotency + Insufficient Balance & Validation Ordering", () => {
        test("insufficient balance rejects repeatedly without persisting idempotency record and allows valid transfer once funded", async () => {
            const userA = await registerTestUser({ email: "insuff-idem-a@example.com" });
            const userB = await registerTestUser({ email: "insuff-idem-b@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            await seedAccountBalance(accA, 5000);

            const key = generateUniqueIdempotencyKey("insuff-retry");

            // Attempt 1 (insufficient balance)
            const firstAttempt = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: accB,
                amount: 20000,
                idempotencyKey: key
            });
            expect(firstAttempt.status).toBe(400);

            // Repeat attempt while still insufficient
            const secondAttempt = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: accB,
                amount: 20000,
                idempotencyKey: key
            });
            expect(secondAttempt.status).toBe(400);

            // Validation/balance failure occurs inside transaction before commit -> no idempotency record stored
            expect(await transactionModel.countDocuments({ idempotencyKey: key })).toBe(0);
            expect(await getAccountBalanceFromDb(accA)).toBe(5000);
            expect(await getAccountBalanceFromDb(accB)).toBe(0);

            // Once funded cleanly, retrying with the same key executes exactly once
            await seedAccountBalance(accA, 20000); // A now has 25000
            const fundedAttempt = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: accB,
                amount: 20000,
                idempotencyKey: key
            });
            expect(fundedAttempt.status).toBe(201);
            expect(await transactionModel.countDocuments({ idempotencyKey: key })).toBe(1);
            expect(await getAccountBalanceFromDb(accA)).toBe(5000);
            expect(await getAccountBalanceFromDb(accB)).toBe(20000);
        });

        test("input validation runs before idempotency persistence (invalid requests leave zero idempotency records)", async () => {
            const userA = await registerTestUser({ email: "val-idem-a@example.com" });
            const userB = await registerTestUser({ email: "val-idem-b@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            await seedAccountBalance(accA, 50000);

            const invalidPayloads = [
                { fromAccount: accA, toAccount: accB, amount: 0, idempotencyKey: generateUniqueIdempotencyKey("inv-zero") },
                { fromAccount: accA, toAccount: accB, amount: -500, idempotencyKey: generateUniqueIdempotencyKey("inv-neg") },
                { fromAccount: accA, toAccount: accB, amount: "12.50", idempotencyKey: generateUniqueIdempotencyKey("inv-dec") },
                { fromAccount: "bad-id", toAccount: accB, amount: 1000, idempotencyKey: generateUniqueIdempotencyKey("inv-src") },
                { fromAccount: accA, toAccount: "bad-id", amount: 1000, idempotencyKey: generateUniqueIdempotencyKey("inv-dst") },
                { fromAccount: accA, toAccount: accA, amount: 1000, idempotencyKey: generateUniqueIdempotencyKey("inv-self") }
            ];

            for (const payload of invalidPayloads) {
                const res = await performTransfer(userA.token, payload);
                expect(res.status).toBe(400);
                expect(await transactionModel.countDocuments({ idempotencyKey: payload.idempotencyKey })).toBe(0);
            }

            expect(await transactionModel.countDocuments({})).toBe(0);
            expect(await getAccountBalanceFromDb(accA)).toBe(50000);
            expect(await getAccountBalanceFromDb(accB)).toBe(0);
        });
    });

    describe("Primary End-to-End Idempotency Regression Invariant", () => {
        test("one logical operation with mixed sequential replays, payload tampering attempts, and concurrent bursts creates exactly 1 transaction and 2 balanced ledger entries", async () => {
            const userA = await registerTestUser({ email: "reg-a@example.com" });
            const userB = await registerTestUser({ email: "reg-b@example.com" });
            const userC = await registerTestUser({ email: "reg-c@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            const accC = (await createAccountForToken(userC.token)).body.account._id;
            await seedAccountBalance(accA, 100000);

            const logicalKey = generateUniqueIdempotencyKey("primary-regression");

            // 1. Concurrent initial burst of 4 identical requests
            const burst = await Promise.all(
                Array.from({ length: 4 }, () =>
                    performTransfer(userA.token, {
                        fromAccount: accA,
                        toAccount: accB,
                        amount: 33333,
                        idempotencyKey: logicalKey
                    })
                )
            );
            expect(burst.filter((r) => r.status === 201)).toHaveLength(1);

            // 2. Sequential exact replay
            const replay = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: accB,
                amount: 33333,
                idempotencyKey: logicalKey
            });
            expect(replay.status).toBe(200);

            // 3. Payload tampering attempts (different amount & different recipient)
            const tamperAmt = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: accB,
                amount: 11111,
                idempotencyKey: logicalKey
            });
            expect(tamperAmt.status).toBe(409);

            const tamperDst = await performTransfer(userA.token, {
                fromAccount: accA,
                toAccount: accC,
                amount: 33333,
                idempotencyKey: logicalKey
            });
            expect(tamperDst.status).toBe(409);

            // 4. Verify complete database invariants
            const txs = await transactionModel.find({ idempotencyKey: logicalKey }).lean();
            expect(txs).toHaveLength(1);
            expect(txs[0].status).toBe("COMPLETED");
            expect(txs[0].amount).toBe(33333);

            const ledgers = await ledgerModel.find({ transaction: txs[0]._id }).lean();
            expect(ledgers).toHaveLength(2);
            const debits = ledgers.filter((l) => l.type === "DEBIT");
            const credits = ledgers.filter((l) => l.type === "CREDIT");
            expect(debits).toHaveLength(1);
            expect(credits).toHaveLength(1);
            expect(debits[0].amount).toBe(33333);
            expect(credits[0].amount).toBe(33333);

            const balA = await getAccountBalanceFromDb(accA);
            const balB = await getAccountBalanceFromDb(accB);
            const balC = await getAccountBalanceFromDb(accC);
            expect(balA).toBe(66667);
            expect(balB).toBe(33333);
            expect(balC).toBe(0);
            expect(balA + balB + balC).toBe(100000);
            expect(await getAccountLedgerEntries(accA)).toHaveLength(2); // 1 seed CREDIT + 1 DEBIT
            expect(await getAccountLedgerEntries(accB)).toHaveLength(1); // 1 CREDIT
        });
    });
});
