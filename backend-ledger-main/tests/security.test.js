const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const app = require("../src/app");
const userModel = require("../src/models/user.model");
const accountModel = require("../src/models/account.model");
const transactionModel = require("../src/models/transaction.model");
const tokenBlackListModel = require("../src/models/blackList.model");
const authController = require("../src/controllers/auth.controller");
const emailService = require("../src/services/email.service");
const { parseStrictOrigin, getAllowedOrigins, DEFAULT_DEPLOYED_FRONTEND_ORIGIN } = require("../src/config/cors");
const { errorHandler, notFoundHandler } = require("../src/middleware/error.middleware");
const {
    generateUniqueIdempotencyKey,
    registerTestUser,
    createSystemUserInDb,
    createAccountForToken,
    seedAccountBalance,
    performTransfer
} = require("./helpers");

describe("Phase 5 Security Hardening & Regression Suite", () => {
    describe("Authentication validation", () => {
        test("rejects missing, whitespace, oversized, and non-string registration inputs with 400 JSON and zero DB writes", async () => {
            const invalidPayloads = [
                [],
                { email: "valid@example.com", password: "Password123" },
                { name: "   ", email: "valid@example.com", password: "Password123" },
                { name: "A".repeat(101), email: "valid@example.com", password: "Password123" },
                { name: "User", email: "", password: "Password123" },
                { name: "User", email: ["valid@example.com"], password: "Password123" },
                { name: "User", email: true, password: "Password123" },
                { name: "User", email: 12345, password: "Password123" },
                { name: "User", email: "valid@example.com", password: ["Password123"] },
                { name: "User", email: "valid@example.com", password: true },
                { name: "User", email: "valid@example.com", password: 123456 },
                { name: "User", email: "valid@example.com", password: "P".repeat(129) }
            ];

            for (const payload of invalidPayloads) {
                const res = await request(app).post("/api/auth/register").send(payload);
                expect(res.status).toBe(400);
                expect(res.body.message).toEqual(expect.any(String));
                expect(res.body.token).toBeUndefined();
            }

            expect(await userModel.countDocuments({})).toBe(0);
        });

        test("rejects invalid/non-primitive login types cleanly with 400 and issues no token", async () => {
            await registerTestUser({ email: "login-val@example.com", password: "Password123" });

            const badLogins = [
                [],
                {},
                { email: "login-val@example.com" },
                { password: "Password123" },
                { email: "bad-email", password: "Password123" },
                { email: ["login-val@example.com"], password: "Password123" },
                { email: true, password: "Password123" },
                { email: "login-val@example.com", password: ["Password123"] },
                { email: "login-val@example.com", password: 123456 },
                { email: "login-val@example.com", password: "" }
            ];

            for (const payload of badLogins) {
                const res = await request(app).post("/api/auth/login").send(payload);
                expect(res.status).toBe(400);
                expect(res.body.token).toBeUndefined();
                expect(res.headers["set-cookie"]).toBeUndefined();
            }
        });

        test("keeps registration resilient when email fails, maps 11000 race to 422, and preserves hash on unchanged profile saves", async () => {
            const consoleErrSpy = jest.spyOn(console, "error").mockImplementation(() => {});
            const emailSpy = jest
                .spyOn(emailService, "sendRegistrationEmail")
                .mockRejectedValueOnce(new Error("SMTP relay unavailable"));

            let registeredId;
            try {
                const regRes = await request(app).post("/api/auth/register").send({
                    name: "Resilient User",
                    email: "resilient-reg@example.com",
                    password: "Password123"
                });
                expect(regRes.status).toBe(201);
                expect(regRes.body.token).toEqual(expect.any(String));
                registeredId = regRes.body.user._id;
            } finally {
                emailSpy.mockRestore();
                consoleErrSpy.mockRestore();
            }

            // Saving an unrelated profile field must not double-hash the existing password
            const savedUser = await userModel.findById(registeredId).select("+password");
            savedUser.name = "Resilient User Updated";
            await savedUser.save();

            const loginAfterUpdate = await request(app).post("/api/auth/login").send({
                email: "resilient-reg@example.com",
                password: "Password123"
            });
            expect(loginAfterUpdate.status).toBe(200);
            expect(loginAfterUpdate.body.token).toEqual(expect.any(String));

            // Concurrent duplicate-key E11000 race during registration maps cleanly to 422 (never 500)
            const dupErr = Object.assign(new Error("E11000 duplicate key error"), {
                name: "MongoServerError",
                code: 11000
            });
            const createSpy = jest.spyOn(userModel, "create").mockRejectedValueOnce(dupErr);
            try {
                const raceRes = await request(app).post("/api/auth/register").send({
                    name: "Race User",
                    email: "race-unique@example.com",
                    password: "Password123"
                });
                expect(raceRes.status).toBe(422);
                expect(raceRes.body.token).toBeUndefined();
                expect(JSON.stringify(raceRes.body)).not.toMatch(/E11000|MongoServerError/i);
            } finally {
                createSpy.mockRestore();
            }
        });
    });

    describe("NoSQL injection & Protected route access after injection attempt", () => {
        test("blocks MongoDB operator payloads in registration ($ne, $gt, $regex, nested objects) with 400", async () => {
            await registerTestUser({ email: "victim@example.com", password: "Password123" });

            const operatorPayloads = [
                { name: "Attacker", email: { $ne: "" }, password: "Password123" },
                { name: "Attacker", email: { $gt: "" }, password: "Password123" },
                { name: "Attacker", email: { $regex: ".*" }, password: "Password123" },
                { name: "Attacker", email: { nested: { $exists: true } }, password: "Password123" },
                { name: "Attacker", email: "ok@example.com", password: { $ne: "" } },
                { name: "Attacker", email: "ok@example.com", password: { $gt: "" } }
            ];

            for (const payload of operatorPayloads) {
                const res = await request(app).post("/api/auth/register").send(payload);
                expect(res.status).toBe(400);
                expect(res.body.token).toBeUndefined();
            }

            expect(await userModel.countDocuments({})).toBe(1);
        });

        test("blocks MongoDB operator login bypass attempts ($ne, $gt, $regex) and prevents follow-up protected route access", async () => {
            const victim = await registerTestUser({
                email: "nosql-victim@example.com",
                password: "SharedPassword123"
            });
            const victimAccount = (await createAccountForToken(victim.token)).body.account._id;
            await seedAccountBalance(victimAccount, 50000);

            const injectionPayloads = [
                { email: { $ne: "" }, password: "SharedPassword123" },
                { email: { $gt: "" }, password: "SharedPassword123" },
                { email: { $regex: "victim" }, password: "SharedPassword123" },
                { email: "nosql-victim@example.com", password: { $ne: "" } },
                { email: { $ne: null }, password: { $ne: null } }
            ];

            for (const payload of injectionPayloads) {
                const loginRes = await request(app).post("/api/auth/login").send(payload);
                expect(loginRes.status).toBe(400);
                expect(loginRes.body.token).toBeUndefined();
                expect(loginRes.body.user).toBeUndefined();
                expect(loginRes.headers["set-cookie"]).toBeUndefined();

                // Verify attacker cannot access any protected endpoints after failed injection attempt
                const attemptToken = loginRes.body.token;
                const accountsRes = await request(app)
                    .get("/api/accounts/")
                    .set("Authorization", `Bearer ${attemptToken}`);
                expect(accountsRes.status).toBe(401);

                const historyRes = await request(app)
                    .get("/api/transactions/")
                    .set("Authorization", `Bearer ${attemptToken}`);
                expect(historyRes.status).toBe(401);

                const transferRes = await request(app)
                    .post("/api/transactions/")
                    .set("Authorization", `Bearer ${attemptToken}`)
                    .send({
                        fromAccount: victimAccount,
                        toAccount: new mongoose.Types.ObjectId().toString(),
                        amount: 1000,
                        idempotencyKey: generateUniqueIdempotencyKey("post-inj")
                    });
                expect(transferRes.status).toBe(401);

                const sysRes = await request(app)
                    .post("/api/transactions/system/initial-funds")
                    .set("Authorization", `Bearer ${attemptToken}`)
                    .send({});
                expect(sysRes.status).toBe(401);
            }

            // Confirm victim account remained completely untouched
            const balRes = await request(app)
                .get(`/api/accounts/balance/${victimAccount}`)
                .set("Authorization", `Bearer ${victim.token}`);
            expect(balRes.status).toBe(200);
            expect(balRes.body.balance).toBe(50000);
        });
    });

    describe("Mass assignment", () => {
        test("ignores privileged fields (role, isAdmin, isSystemUser, systemUser, _id) on registration", async () => {
            const attackerSuppliedId = new mongoose.Types.ObjectId().toString();

            const res = await request(app).post("/api/auth/register").send({
                _id: attackerSuppliedId,
                name: "Attacker",
                email: "mass-assign@example.com",
                password: "Password123",
                role: "admin",
                isAdmin: true,
                isSystemUser: true,
                systemUser: true
            });

            expect(res.status).toBe(201);
            expect(res.body.user._id).not.toBe(attackerSuppliedId);
            expect(res.body.user.role).toBeUndefined();
            expect(res.body.user.isAdmin).toBeUndefined();
            expect(res.body.user.isSystemUser).toBeUndefined();
            expect(res.body.user.systemUser).toBeUndefined();

            const dbUser = await userModel
                .findById(res.body.user._id)
                .select("+systemUser")
                .lean();
            expect(dbUser.systemUser).toBe(false);
            expect(dbUser.role).toBeUndefined();
            expect(dbUser.isAdmin).toBeUndefined();
            expect(dbUser.isSystemUser).toBeUndefined();

            // Verify attacker cannot access system route
            const sysRes = await request(app)
                .post("/api/transactions/system/initial-funds")
                .set("Authorization", `Bearer ${res.body.token}`)
                .set("x-system-admin-key", process.env.SYSTEM_ADMIN_KEY)
                .send({});
            expect(sysRes.status).toBe(403);
        });
    });

    describe("Logout & Cookie security", () => {
        test("sets httpOnly & SameSite cookie flags safely per environment and executes idempotent repeat logout", async () => {
            const regRes = await request(app).post("/api/auth/register").send({
                name: "Cookie User",
                email: "cookie-sec@example.com",
                password: "Password123"
            });
            expect(regRes.status).toBe(201);

            const testCookie = regRes.headers["set-cookie"].find((c) => c.startsWith("token="));
            expect(testCookie).toMatch(/HttpOnly/i);
            expect(testCookie).toMatch(/SameSite=Lax/i);
            expect(testCookie).not.toMatch(/;\s*Secure/i); // Allows HTTP in local dev/test

            // Production cookie hardening check (Secure + HttpOnly + SameSite=None for cross-site HTTPS)
            const prevEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = "production";
            try {
                const prodLoginRes = await request(app).post("/api/auth/login").send({
                    email: "cookie-sec@example.com",
                    password: "Password123"
                });
                expect(prodLoginRes.status).toBe(200);
                const prodCookie = prodLoginRes.headers["set-cookie"].find((c) => c.startsWith("token="));
                expect(prodCookie).toMatch(/HttpOnly/i);
                expect(prodCookie).toMatch(/Secure/i);
                expect(prodCookie).toMatch(/SameSite=None/i);
            } finally {
                process.env.NODE_ENV = prevEnv;
            }

            // First + second logout with same token both return 200 (never 500 E11000)
            const logout1 = await request(app)
                .post("/api/auth/logout")
                .set("Authorization", `Bearer ${regRes.body.token}`);
            expect(logout1.status).toBe(200);

            const logout2 = await request(app)
                .post("/api/auth/logout")
                .set("Authorization", `Bearer ${regRes.body.token}`);
            expect(logout2.status).toBe(200);

            expect(await tokenBlackListModel.countDocuments({ token: regRes.body.token })).toBe(1);

            // Token remains unusable after logout
            const afterLogout = await request(app)
                .get("/api/accounts/")
                .set("Authorization", `Bearer ${regRes.body.token}`);
            expect(afterLogout.status).toBe(401);
        });

        test("ignores arbitrary malformed strings on logout instead of bloating blacklist DB", async () => {
            const res = await request(app)
                .post("/api/auth/logout")
                .set("Authorization", "Bearer garbage.untrusted.token");

            expect(res.status).toBe(200);
            expect(await tokenBlackListModel.countDocuments({})).toBe(0);
        });
    });

    describe("Error handling & database error sanitization", () => {
        test("returns JSON 404 for unknown routes and JSON 400 without stack traces on malformed JSON", async () => {
            const unknownRes = await request(app).get("/api/nonexistent/route");
            expect(unknownRes.status).toBe(404);
            expect(unknownRes.headers["content-type"]).toMatch(/application\/json/);
            expect(unknownRes.body).toEqual({ message: "Route not found" });

            const badJsonRes = await request(app)
                .post("/api/auth/login")
                .set("Content-Type", "application/json")
                .send('{"email": "broken');
            expect(badJsonRes.status).toBe(400);
            expect(badJsonRes.headers["content-type"]).toMatch(/application\/json/);
            expect(badJsonRes.body.message).toBe("Malformed JSON request body");
            expect(badJsonRes.body.stack).toBeUndefined();

            // Oversized payload > 100kb JSON limit triggers clean 413 JSON
            const oversizedRes = await request(app)
                .post("/api/auth/login")
                .send({ email: "oversized@example.com", password: "A".repeat(120 * 1024) });
            expect(oversizedRes.status).toBe(413);
            expect(oversizedRes.body).toEqual({ message: "Request payload too large" });
        });

        test("sanitizes ValidationError, CastError, duplicate-key 11000, operational 4xx, and unexpected 500s across routes/middleware", async () => {
            const testApp = express();
            testApp.get("/err/validation", () => {
                const e = new mongoose.Error.ValidationError();
                throw e;
            });
            testApp.get("/err/cast", () => {
                throw new mongoose.Error.CastError("ObjectId", "bad", "_id");
            });
            testApp.get("/err/dup", () => {
                const e = new Error("E11000 duplicate key error collection: prod.users index: email_1");
                e.name = "MongoServerError";
                e.code = 11000;
                throw e;
            });
            testApp.get("/err/operational", () => {
                const e = new Error("Custom operational rejection");
                e.statusCode = 422;
                throw e;
            });
            testApp.get("/err/internal", () => {
                throw new Error("C:\\secret\\path\\db.js connection failed");
            });
            testApp.use(notFoundHandler);
            testApp.use(errorHandler);

            const vRes = await request(testApp).get("/err/validation");
            expect(vRes.status).toBe(400);
            expect(vRes.body).toEqual({ message: "Request validation failed" });

            const cRes = await request(testApp).get("/err/cast");
            expect(cRes.status).toBe(400);
            expect(cRes.body).toEqual({ message: "Invalid identifier or input format" });

            const dRes = await request(testApp).get("/err/dup");
            expect(dRes.status).toBe(409);
            expect(dRes.body).toEqual({ message: "Resource conflict" });
            expect(JSON.stringify(dRes.body)).not.toMatch(/users|email_1|E11000/i);

            const opRes = await request(testApp).get("/err/operational");
            expect(opRes.status).toBe(422);
            expect(opRes.body).toEqual({ message: "Custom operational rejection" });

            const errorConsoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
            try {
                const iRes = await request(testApp).get("/err/internal");
                expect(iRes.status).toBe(500);
                expect(iRes.body).toEqual({ message: "Internal server error" });
                expect(JSON.stringify(iRes.body)).not.toMatch(/secret|db\.js|stack/i);

                // Verify real auth middleware & auth controller async failures forward safely via next(err)
                const user = await registerTestUser({ email: "err-prop@example.com" });

                const loginErrSpy = jest.spyOn(userModel, "findOne").mockReturnValueOnce({
                    select: jest.fn().mockRejectedValueOnce(new Error("C:\\internal\\mongo\\socket failed"))
                });
                const login500 = await request(app)
                    .post("/api/auth/login")
                    .send({ email: "err-prop@example.com", password: "StrongPass123" });
                loginErrSpy.mockRestore();
                expect(login500.status).toBe(500);
                expect(login500.body).toEqual({ message: "Internal server error" });

                const logoutErrSpy = jest
                    .spyOn(tokenBlackListModel, "findOneAndUpdate")
                    .mockRejectedValueOnce(new Error("ReplicaSet write failure"));
                const logout500 = await request(app)
                    .post("/api/auth/logout")
                    .set("Authorization", `Bearer ${user.token}`);
                logoutErrSpy.mockRestore();
                expect(logout500.status).toBe(500);
                expect(logout500.body).toEqual({ message: "Internal server error" });

                const mwErrSpy = jest
                    .spyOn(tokenBlackListModel, "findOne")
                    .mockRejectedValueOnce(new Error("Blacklist lookup timeout"))
                    .mockRejectedValueOnce(new Error("System blacklist lookup timeout"));
                const protected500 = await request(app)
                    .get("/api/accounts/")
                    .set("Authorization", `Bearer ${user.token}`);
                const sysProtected500 = await request(app)
                    .post("/api/transactions/system/initial-funds")
                    .set("Authorization", `Bearer ${user.token}`);
                mwErrSpy.mockRestore();
                expect(protected500.status).toBe(500);
                expect(protected500.body).toEqual({ message: "Internal server error" });
                expect(sysProtected500.status).toBe(500);
                expect(sysProtected500.body).toEqual({ message: "Internal server error" });
            } finally {
                errorConsoleSpy.mockRestore();
            }
        });
    });

    describe("Security headers", () => {
        test("attaches Helmet security headers and hides X-Powered-By", async () => {
            const res = await request(app).get("/");

            expect(res.status).toBe(200);
            expect(res.headers["x-powered-by"]).toBeUndefined();
            expect(res.headers["x-content-type-options"]).toBe("nosniff");
            expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
            expect(res.headers["x-dns-prefetch-control"]).toBe("off");
            expect(res.headers["referrer-policy"]).toBeDefined();
            expect(res.headers["cross-origin-opener-policy"]).toBeDefined();
        });
    });

    describe("Rate limiting", () => {
        test("enforces auth rate limits cleanly and returns 429 JSON once configured threshold is exceeded", async () => {
            const prevMax = process.env.AUTH_RATE_LIMIT_MAX;
            const prevWin = process.env.AUTH_RATE_LIMIT_WINDOW_MS;

            let limitedApp;
            let defaultLimiterApp;
            try {
                process.env.AUTH_RATE_LIMIT_MAX = "3";
                process.env.AUTH_RATE_LIMIT_WINDOW_MS = "60000";

                jest.isolateModules(() => {
                    const { createAuthLimiters, createAuthRateLimiter } = require("../src/middleware/rateLimit.middleware");
                    const { loginRateLimiter, registerRateLimiter, logoutRateLimiter } = createAuthLimiters();

                    const miniApp = express();
                    miniApp.use(express.json());
                    miniApp.post("/api/auth/login", loginRateLimiter, authController.userLoginController);
                    miniApp.post("/api/auth/register", registerRateLimiter, authController.userRegisterController);
                    miniApp.post("/api/auth/logout", logoutRateLimiter, authController.userLogoutController);
                    miniApp.use(errorHandler);
                    limitedApp = miniApp;

                    // Verify invalid env numeric string falls back cleanly to default test limit (500)
                    process.env.AUTH_RATE_LIMIT_MAX = "not-a-number";
                    const fallbackLimiter = createAuthRateLimiter({ max: 2 });
                    const fallbackMini = express();
                    fallbackMini.post("/test-limit", fallbackLimiter, (_req, res) => res.json({ ok: true }));

                    // Verify omitted custom message falls back to default 429 JSON error message
                    process.env.AUTH_RATE_LIMIT_MAX = "1";
                    const strictDefaultMsgLimiter = createAuthRateLimiter({ max: 2 });
                    fallbackMini.post("/test-default-msg", strictDefaultMsgLimiter, (_req, res) => res.json({ ok: true }));
                    defaultLimiterApp = fallbackMini;
                });

                // Login limiter: 3 allowed attempts (401 invalid credentials), 4th -> 429
                for (let i = 0; i < 3; i++) {
                    const r = await request(limitedApp).post("/api/auth/login").send({
                        email: "nonexistent@example.com",
                        password: "WrongPassword123"
                    });
                    expect(r.status).toBe(401);
                    expect(r.headers["ratelimit-limit"]).toBe("3");
                }
                const loginBlocked = await request(limitedApp).post("/api/auth/login").send({
                    email: "nonexistent@example.com",
                    password: "WrongPassword123"
                });
                expect(loginBlocked.status).toBe(429);
                expect(loginBlocked.body.message).toMatch(/too many login attempts/i);

                // Register limiter: 3 allowed attempts, 4th -> 429
                for (let i = 0; i < 3; i++) {
                    const r = await request(limitedApp).post("/api/auth/register").send({
                        name: "Bad",
                        email: "invalid-email",
                        password: "123"
                    });
                    expect(r.status).toBe(400);
                }
                const registerBlocked = await request(limitedApp).post("/api/auth/register").send({
                    name: "Valid",
                    email: "ok-after-limit@example.com",
                    password: "Password123"
                });
                expect(registerBlocked.status).toBe(429);
                expect(registerBlocked.body.message).toMatch(/too many registration attempts/i);

                // Logout limiter: 3 allowed attempts, 4th -> 429
                for (let i = 0; i < 3; i++) {
                    const r = await request(limitedApp).post("/api/auth/logout").send({});
                    expect(r.status).toBe(200);
                }
                const logoutBlocked = await request(limitedApp).post("/api/auth/logout").send({});
                expect(logoutBlocked.status).toBe(429);
                expect(logoutBlocked.body.message).toMatch(/too many logout requests/i);

                // Verify invalid AUTH_RATE_LIMIT_MAX falls back cleanly to default (500 in NODE_ENV=test)
                const fallbackOk = await request(defaultLimiterApp).post("/test-limit");
                expect(fallbackOk.status).toBe(200);
                expect(fallbackOk.headers["ratelimit-limit"]).toBe("500");

                // Verify default 429 message when limiter omits custom message
                expect((await request(defaultLimiterApp).post("/test-default-msg")).status).toBe(200);
                const defaultMsgBlocked = await request(defaultLimiterApp).post("/test-default-msg");
                expect(defaultMsgBlocked.status).toBe(429);
                expect(defaultMsgBlocked.body.message).toMatch(/too many authentication attempts/i);
            } finally {
                if (prevMax === undefined) delete process.env.AUTH_RATE_LIMIT_MAX;
                else process.env.AUTH_RATE_LIMIT_MAX = prevMax;
                if (prevWin === undefined) delete process.env.AUTH_RATE_LIMIT_WINDOW_MS;
                else process.env.AUTH_RATE_LIMIT_WINDOW_MS = prevWin;
            }
        });
    });

    describe("CORS", () => {
        test("allows exact configured frontend origin with credentials and rejects untrusted origins + production localhost", async () => {
            // Deployed Render origin allowed with credentials, never "*"
            const allowedRes = await request(app)
                .options("/api/auth/login")
                .set("Origin", "https://secured-ledgure-frontend.onrender.com")
                .set("Access-Control-Request-Method", "POST")
                .set("Access-Control-Request-Headers", "Content-Type, Authorization");

            expect(allowedRes.status).toBe(204);
            expect(allowedRes.headers["access-control-allow-origin"]).toBe(
                "https://secured-ledgure-frontend.onrender.com"
            );
            expect(allowedRes.headers["access-control-allow-credentials"]).toBe("true");
            expect(allowedRes.headers["access-control-allow-origin"]).not.toBe("*");

            // Arbitrary/untrusted origin denied
            const evilRes = await request(app)
                .options("/api/auth/login")
                .set("Origin", "https://evil-attacker.example")
                .set("Access-Control-Request-Method", "POST");
            expect(evilRes.headers["access-control-allow-origin"]).toBeUndefined();

            // Production mode rejects localhost fallback while allowing FRONTEND_ORIGIN
            let prodCorsApp;
            jest.isolateModules(() => {
                const { createCorsMiddleware } = require("../src/config/cors");
                const prodCors = createCorsMiddleware({
                    NODE_ENV: "production",
                    FRONTEND_ORIGIN: "https://secured-ledgure-frontend.onrender.com"
                });
                const eApp = express();
                eApp.use(prodCors);
                eApp.options(/^\/api(?:\/.*)?$/, prodCors);
                eApp.get("/api/ping", (req, res) => res.json({ ok: true }));
                prodCorsApp = eApp;
            });

            const prodLocal = await request(prodCorsApp)
                .options("/api/ping")
                .set("Origin", "http://localhost:5173")
                .set("Access-Control-Request-Method", "GET");
            expect(prodLocal.headers["access-control-allow-origin"]).toBeUndefined();

            const prodAllowed = await request(prodCorsApp)
                .options("/api/ping")
                .set("Origin", "https://secured-ledgure-frontend.onrender.com")
                .set("Access-Control-Request-Method", "GET");
            expect(prodAllowed.status).toBe(204);
            expect(prodAllowed.headers["access-control-allow-origin"]).toBe(
                "https://secured-ledgure-frontend.onrender.com"
            );

            // Requests without an Origin header receive no Access-Control-Allow-Origin reflection
            const sameOriginRes = await request(app).get("/");
            expect(sameOriginRes.status).toBe(200);
            expect(sameOriginRes.headers["access-control-allow-origin"]).toBeUndefined();

            // Strict origin parsing rejects non-string, wildcard "*", non-HTTP(S) schemes, and malformed URLs
            expect(parseStrictOrigin(null)).toBeNull();
            expect(parseStrictOrigin("*")).toBeNull();
            expect(parseStrictOrigin("ftp://evil.example")).toBeNull();
            expect(parseStrictOrigin("not a valid origin")).toBeNull();

            const sanitizedAllowlist = getAllowedOrigins({
                NODE_ENV: "production",
                FRONTEND_ORIGIN: "*, ftp://evil.example, not-a-url"
            });
            expect(Array.from(sanitizedAllowlist)).toEqual([DEFAULT_DEPLOYED_FRONTEND_ORIGIN]);
        });
    });

    describe("IDOR & Transaction history isolation", () => {
        test("blocks cross-user account access, transfer initiation, and history search/key/ID probes", async () => {
            const userA = await registerTestUser({ email: "sec-idor-a@example.com" });
            const userB = await registerTestUser({ email: "sec-idor-b@example.com" });
            const userC = await registerTestUser({ email: "sec-idor-c@example.com" });

            const accA = (await createAccountForToken(userA.token)).body.account._id;
            const accB = (await createAccountForToken(userB.token)).body.account._id;
            const accC = (await createAccountForToken(userC.token)).body.account._id;

            await seedAccountBalance(accA, 50000);
            await seedAccountBalance(accB, 50000);

            const secretKeyB = generateUniqueIdempotencyKey("userB-private-key");
            const txBC = await performTransfer(userB.token, {
                fromAccount: accB,
                toAccount: accC,
                amount: 10000,
                idempotencyKey: secretKeyB
            });
            expect(txBC.status).toBe(201);
            const txBCId = txBC.body.transaction._id;

            // 1. User A cannot inspect User B's account balance
            expect(
                (await request(app).get(`/api/accounts/balance/${accB}`).set("Authorization", `Bearer ${userA.token}`)).status
            ).toBe(404);

            // 2. User B cannot inspect User A's account balance
            expect(
                (await request(app).get(`/api/accounts/balance/${accA}`).set("Authorization", `Bearer ${userB.token}`)).status
            ).toBe(404);

            // 3. User A cannot transfer from User B's account
            expect(
                (await performTransfer(userA.token, { fromAccount: accB, toAccount: accA, amount: 5000 })).status
            ).toBe(404);

            // 4. User A cannot probe User B->C transaction via history ObjectId or key search
            const probeTxId = await request(app)
                .get(`/api/transactions/?search=${txBCId}`)
                .set("Authorization", `Bearer ${userA.token}`);
            expect(probeTxId.status).toBe(200);
            expect(probeTxId.body.transactions).toHaveLength(0);

            const probeAccB = await request(app)
                .get(`/api/transactions/?search=${accB}`)
                .set("Authorization", `Bearer ${userA.token}`);
            expect(probeAccB.status).toBe(200);
            expect(probeAccB.body.transactions).toHaveLength(0);

            const probeKeyB = await request(app)
                .get(`/api/transactions/?search=${secretKeyB}`)
                .set("Authorization", `Bearer ${userA.token}`);
            expect(probeKeyB.status).toBe(200);
            expect(probeKeyB.body.transactions).toHaveLength(0);

            // 5. Recipient User C cannot discover sender User B's idempotency key via history search
            const recipientProbeKey = await request(app)
                .get(`/api/transactions/?search=${secretKeyB}`)
                .set("Authorization", `Bearer ${userC.token}`);
            expect(recipientProbeKey.status).toBe(200);
            expect(recipientProbeKey.body.transactions).toHaveLength(0);

            // 6. Regex metacharacters in search do not crash or trigger 500
            const redosSearch = await request(app)
                .get(`/api/transactions/?search=${encodeURIComponent("((((a+)+)$[")}`)
                .set("Authorization", `Bearer ${userB.token}`);
            expect(redosSearch.status).toBe(200);
            expect(redosSearch.body.transactions).toHaveLength(0);

            // 7. Malformed/repeated query params return 400 and bracketed operator params never leak other users' data
            const dupTypeRes = await request(app)
                .get("/api/transactions/?type=CREDIT&type=DEBIT")
                .set("Authorization", `Bearer ${userA.token}`);
            expect(dupTypeRes.status).toBe(400);

            const dupSearchRes = await request(app)
                .get("/api/transactions/?search=a&search=b")
                .set("Authorization", `Bearer ${userA.token}`);
            expect(dupSearchRes.status).toBe(400);

            const opTypeRes = await request(app)
                .get("/api/transactions/?type[$ne]=CREDIT")
                .set("Authorization", `Bearer ${userA.token}`);
            expect(opTypeRes.status).toBe(200);
            expect(opTypeRes.body.transactions).toHaveLength(0);
        });
    });

    describe("Authorization & JWT security", () => {
        test("rejects manipulated JWT role/systemUser claims, non-Bearer schemes, tampered signatures, and expired/blacklisted tokens", async () => {
            const normal = await registerTestUser({ email: "sec-jwt@example.com" });

            // Forged elevated claims signed even with valid secret must NOT grant systemUser access (DB checked)
            const elevatedClaimJwt = jwt.sign(
                { userId: normal.user._id, systemUser: true, role: "admin", isAdmin: true },
                process.env.JWT_SECRET,
                { expiresIn: "1h" }
            );
            const elevatedSysRes = await request(app)
                .post("/api/transactions/system/initial-funds")
                .set("Authorization", `Bearer ${elevatedClaimJwt}`)
                .set("x-system-admin-key", process.env.SYSTEM_ADMIN_KEY)
                .send({ role: "admin", systemUser: true });
            expect(elevatedSysRes.status).toBe(403);

            // Non-Bearer Authorization scheme (e.g. Basic) rejected 401
            const basicAuthRes = await request(app)
                .get("/api/accounts/")
                .set("Authorization", `Basic ${normal.token}`);
            expect(basicAuthRes.status).toBe(401);

            // Tampered signature rejected 401
            const parts = normal.token.split(".");
            const tampered = `${parts[0]}.${parts[1]}.tamperedSignature123`;
            expect(
                (await request(app).get("/api/accounts/").set("Authorization", `Bearer ${tampered}`)).status
            ).toBe(401);

            // Unsigned alg=none style JWT rejected 401
            const headerNone = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
            const payloadUser = Buffer.from(JSON.stringify({ userId: normal.user._id })).toString("base64url");
            expect(
                (await request(app).get("/api/accounts/").set("Authorization", `Bearer ${headerNone}.${payloadUser}.`)).status
            ).toBe(401);

            // Expired & blacklisted rejected 401
            const expired = jwt.sign({ userId: normal.user._id }, process.env.JWT_SECRET, { expiresIn: "-5s" });
            expect(
                (await request(app).get("/api/accounts/").set("Authorization", `Bearer ${expired}`)).status
            ).toBe(401);

            await tokenBlackListModel.create({ token: normal.token });
            expect(
                (await request(app).get("/api/accounts/").set("Authorization", `Bearer ${normal.token}`)).status
            ).toBe(401);

            // Validly signed JWT containing malformed / missing userId claim rejected cleanly with 401 (not 500 CastError)
            const invalidClaimIdToken = jwt.sign(
                { userId: "not-a-valid-objectid" },
                process.env.JWT_SECRET,
                { expiresIn: "1h" }
            );
            expect(
                (await request(app).get("/api/accounts/").set("Authorization", `Bearer ${invalidClaimIdToken}`)).status
            ).toBe(401);

            const missingClaimIdToken = jwt.sign({}, process.env.JWT_SECRET, { expiresIn: "1h" });
            expect(
                (await request(app).get("/api/accounts/").set("Authorization", `Bearer ${missingClaimIdToken}`)).status
            ).toBe(401);

            // System user verified cleanly from DB still cannot execute disabled 501 endpoint without or with empty key (403)
            const sysUser = await createSystemUserInDb();
            const sysJwt = jwt.sign({ userId: sysUser._id.toString() }, process.env.JWT_SECRET, { expiresIn: "1h" });
            expect(
                (await request(app).post("/api/transactions/system/initial-funds").set("Authorization", `Bearer ${sysJwt}`)).status
            ).toBe(403);
            expect(
                (
                    await request(app)
                        .post("/api/transactions/system/initial-funds")
                        .set("Authorization", `Bearer ${sysJwt}`)
                        .set("x-system-admin-key", "")
                ).status
            ).toBe(403);
        });
    });
});
