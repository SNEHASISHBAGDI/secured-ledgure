const request = require("supertest");
const mongoose = require("mongoose");

const app = require("../src/app");
const accountModel = require("../src/models/account.model");
const ledgerModel = require("../src/models/ledger.model");
const { registerTestUser, createAccountForToken } = require("./helpers");

describe("Accounts, Ownership Isolation & Derived Balance API", () => {
    describe("Test Environment & Replica Set Verification", () => {
        test("connects to isolated local MongoMemoryReplSet and supports multi-document ACID sessions", async () => {
            expect(mongoose.connection.readyState).toBe(1);
            expect(mongoose.connection.name).toBe("secure-ledger-test");

            const session = await mongoose.startSession();
            session.startTransaction();
            expect(session.inTransaction()).toBe(true);
            await session.abortTransaction();
            await session.endSession();
        });
    });

    describe("POST /api/accounts/ — Protected Account Creation", () => {
        test("rejects unauthenticated account creation with 401", async () => {
            const res = await request(app).post("/api/accounts/").send({});
            expect(res.status).toBe(401);
            expect(await accountModel.countDocuments({})).toBe(0);
        });

        test("creates an ACTIVE INR account owned by authenticated user and persists in DB", async () => {
            const { user, token } = await registerTestUser();

            const res = await createAccountForToken(token);

            expect(res.status).toBe(201);
            expect(res.body.account).toBeDefined();
            expect(res.body.account.user).toBe(user._id);
            expect(res.body.account.status).toBe("ACTIVE");
            expect(res.body.account.currency).toBe("INR");

            // Direct DB verification
            const dbAccount = await accountModel.findById(res.body.account._id);
            expect(dbAccount).not.toBeNull();
            expect(dbAccount.user.toString()).toBe(user._id);
            expect(dbAccount.status).toBe("ACTIVE");
            expect(dbAccount.currency).toBe("INR");
        });
    });

    describe("GET /api/accounts/ — Ownership Isolation", () => {
        test("rejects unauthenticated GET /api/accounts/ with 401", async () => {
            const res = await request(app).get("/api/accounts/");
            expect(res.status).toBe(401);
        });

        test("returns strictly the authenticated user's own accounts and isolates User A from User B", async () => {
            const userA = await registerTestUser({ email: "usera@example.com" });
            const userB = await registerTestUser({ email: "userb@example.com" });

            const accARes1 = await createAccountForToken(userA.token);
            const accARes2 = await createAccountForToken(userA.token);
            const accBRes = await createAccountForToken(userB.token);

            const accA1Id = accARes1.body.account._id;
            const accA2Id = accARes2.body.account._id;
            const accBId = accBRes.body.account._id;

            const listA = await request(app)
                .get("/api/accounts/")
                .set("Authorization", `Bearer ${userA.token}`);
            expect(listA.status).toBe(200);
            expect(listA.body.accounts).toHaveLength(2);
            expect(listA.body.accounts.map((a) => a._id).sort()).toEqual([accA1Id, accA2Id].sort());
            expect(listA.body.accounts.some((a) => a._id === accBId)).toBe(false);

            const listB = await request(app)
                .get("/api/accounts/")
                .set("Authorization", `Bearer ${userB.token}`);
            expect(listB.status).toBe(200);
            expect(listB.body.accounts).toHaveLength(1);
            expect(listB.body.accounts[0]._id).toBe(accBId);
            expect(listB.body.accounts.some((a) => a._id === accA1Id)).toBe(false);
        });
    });

    describe("GET /api/accounts/balance/:accountId — Balance & Cross-User Isolation", () => {
        test("returns 401 when unauthenticated", async () => {
            const validFormatId = new mongoose.Types.ObjectId().toString();
            const res = await request(app).get(`/api/accounts/balance/${validFormatId}`);
            expect(res.status).toBe(401);
        });

        test("returns 200 with 0 integer paise balance for newly created owned account", async () => {
            const { token } = await registerTestUser();
            const created = await createAccountForToken(token);
            const accountId = created.body.account._id;

            const res = await request(app)
                .get(`/api/accounts/balance/${accountId}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                accountId,
                balance: 0,
                currency: "INR",
                unit: "PAISE"
            });
            expect(Number.isSafeInteger(res.body.balance)).toBe(true);
        });

        test("computes derived balance accurately in integer paise from ledger entries", async () => {
            const { token } = await registerTestUser();
            const created = await createAccountForToken(token);
            const accountId = created.body.account._id;
            const dummyTxId = new mongoose.Types.ObjectId();

            // Seed immutable ledger entries directly in isolated test DB to verify getBalance() math
            await ledgerModel.create([
                { account: accountId, amount: 25050, transaction: dummyTxId, type: "CREDIT" },
                { account: accountId, amount: 5025, transaction: dummyTxId, type: "DEBIT" }
            ]);

            const res = await request(app)
                .get(`/api/accounts/balance/${accountId}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.accountId).toBe(accountId);
            expect(res.body.balance).toBe(20025);
            expect(res.body.currency).toBe("INR");
            expect(res.body.unit).toBe("PAISE");
            expect(Number.isSafeInteger(res.body.balance)).toBe(true);
        });

        test("prevents cross-user balance access: User A cannot inspect User B's account and vice versa", async () => {
            const userA = await registerTestUser({ email: "iso-a@example.com" });
            const userB = await registerTestUser({ email: "iso-b@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;

            const aChecksB = await request(app)
                .get(`/api/accounts/balance/${accB}`)
                .set("Authorization", `Bearer ${userA.token}`);
            expect(aChecksB.status).toBe(404);
            expect(aChecksB.body.balance).toBeUndefined();

            const bChecksA = await request(app)
                .get(`/api/accounts/balance/${accA}`)
                .set("Authorization", `Bearer ${userB.token}`);
            expect(bChecksA.status).toBe(404);
            expect(bChecksA.body.balance).toBeUndefined();
        });

        test("returns 404 for nonexistent valid ObjectId", async () => {
            const { token } = await registerTestUser();
            const missingId = new mongoose.Types.ObjectId().toString();

            const res = await request(app)
                .get(`/api/accounts/balance/${missingId}`)
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(404);
        });

        test("returns 400 for malformed accountId formats", async () => {
            const { token } = await registerTestUser();

            for (const badId of ["not-an-id", "12345", "zzzzzzzzzzzzzzzzzzzzzzzz"]) {
                const res = await request(app)
                    .get(`/api/accounts/balance/${badId}`)
                    .set("Authorization", `Bearer ${token}`);

                expect(res.status).toBe(400);
            }
        });
    });
});
