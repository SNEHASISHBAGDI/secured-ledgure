const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const app = require("../src/app");
const userModel = require("../src/models/user.model");
const tokenBlackListModel = require("../src/models/blackList.model");
const emailService = require("../src/services/email.service");
const { registerTestUser, createSystemUserInDb } = require("./helpers");

describe("Authentication, Authorization & Token Lifecycle API", () => {
    describe("POST /api/auth/register — Registration & Mass Assignment", () => {
        test("registers a valid user, hashes password in DB, returns JWT + cookie, omits sensitive fields, and uses mocked email service", async () => {
            const payload = {
                name: "Alice Ledger",
                email: "Alice@Example.com",
                password: "SecurePassword123"
            };

            const res = await request(app).post("/api/auth/register").send(payload);

            expect(res.status).toBe(201);
            expect(res.body.user).toBeDefined();
            expect(res.body.user._id).toBeDefined();
            expect(res.body.user.email).toBe("alice@example.com");
            expect(res.body.user.name).toBe("Alice Ledger");
            expect(res.body.user.password).toBeUndefined();
            expect(res.body.password).toBeUndefined();
            expect(res.body.user.systemUser).toBeUndefined();

            // JWT validity check
            expect(typeof res.body.token).toBe("string");
            const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
            expect(decoded.userId).toBe(res.body.user._id);

            // Capture current cookie behavior
            const setCookieHeaders = res.headers["set-cookie"];
            expect(Array.isArray(setCookieHeaders)).toBe(true);
            expect(setCookieHeaders.some((c) => c.startsWith(`token=${res.body.token}`))).toBe(true);

            // Direct DB assertions
            const dbUser = await userModel
                .findById(res.body.user._id)
                .select("+password +systemUser");
            expect(dbUser).not.toBeNull();
            expect(dbUser.email).toBe("alice@example.com");
            expect(dbUser.password).not.toBe("SecurePassword123");
            expect(await bcrypt.compare("SecurePassword123", dbUser.password)).toBe(true);
            expect(dbUser.systemUser).toBe(false);

            // Email transport was mocked — never connects to Gmail
            expect(emailService.sendRegistrationEmail).toHaveBeenCalledTimes(1);
            expect(emailService.sendRegistrationEmail).toHaveBeenCalledWith(
                "alice@example.com",
                "Alice Ledger"
            );
        });

        test("rejects duplicate email with 422 and creates no second user in DB", async () => {
            await registerTestUser({ email: "dup@example.com" });

            const res = await request(app).post("/api/auth/register").send({
                name: "Duplicate User",
                email: "dup@example.com",
                password: "Password123"
            });

            expect(res.status).toBe(422);
            expect(res.body.status).toBe("failed");

            const count = await userModel.countDocuments({ email: "dup@example.com" });
            expect(count).toBe(1);
        });

        test("prevents systemUser mass assignment via registration body", async () => {
            const res = await request(app).post("/api/auth/register").send({
                name: "Escalation Attempt",
                email: "escalate@example.com",
                password: "Password123",
                systemUser: true
            });

            expect(res.status).toBe(201);
            expect(res.body.user.systemUser).toBeUndefined();

            const dbUser = await userModel
                .findById(res.body.user._id)
                .select("+systemUser");
            expect(dbUser).not.toBeNull();
            expect(dbUser.systemUser).toBe(false);
        });

        test("rejects invalid JSON malformed request body with 400", async () => {
            const res = await request(app)
                .post("/api/auth/register")
                .set("Content-Type", "application/json")
                .send('{"email": "bad-json"');

            expect(res.status).toBe(400);
        });

        test("rejects invalid email format cleanly (400/422, not 500)", async () => {
            const res = await request(app).post("/api/auth/register").send({
                name: "Bad Email",
                email: "not-a-valid-email",
                password: "Password123"
            });

            expect([400, 422]).toContain(res.status);
            expect(await userModel.countDocuments({})).toBe(0);
        });

        test("rejects missing email cleanly (400/422, not 500)", async () => {
            const res = await request(app).post("/api/auth/register").send({
                name: "Missing Email",
                password: "Password123"
            });

            expect([400, 422]).toContain(res.status);
            expect(await userModel.countDocuments({})).toBe(0);
        });

        test("rejects missing password cleanly (400/422, not 500)", async () => {
            const res = await request(app).post("/api/auth/register").send({
                name: "Missing Password",
                email: "nopass@example.com"
            });

            expect([400, 422]).toContain(res.status);
            expect(await userModel.countDocuments({})).toBe(0);
        });

        test("rejects password shorter than model minimum cleanly (400/422, not 500)", async () => {
            const res = await request(app).post("/api/auth/register").send({
                name: "Short Password",
                email: "short@example.com",
                password: "12345"
            });

            expect([400, 422]).toContain(res.status);
            expect(await userModel.countDocuments({})).toBe(0);
        });

        test("rejects missing name cleanly (400/422, not 500)", async () => {
            const res = await request(app).post("/api/auth/register").send({
                email: "noname@example.com",
                password: "Password123"
            });

            expect([400, 422]).toContain(res.status);
            expect(await userModel.countDocuments({})).toBe(0);
        });

        test("rejects empty request body cleanly (400/422, not 500)", async () => {
            const res = await request(app).post("/api/auth/register").send({});

            expect([400, 422]).toContain(res.status);
            expect(await userModel.countDocuments({})).toBe(0);
        });

        test("rejects NoSQL object payload in email ($ne operator) with 400 validation error", async () => {
            await registerTestUser({ email: "existing@example.com" });

            const res = await request(app).post("/api/auth/register").send({
                name: "Injection Probe",
                email: { $ne: "" },
                password: "Password123"
            });

            expect(res.status).toBe(400);
        });

        test("rejects NoSQL object payload in password ($ne operator) with 400 validation error", async () => {
            const res = await request(app).post("/api/auth/register").send({
                name: "Injection Probe",
                email: "probe@example.com",
                password: { $ne: "" }
            });

            expect(res.status).toBe(400);
        });
    });

    describe("POST /api/auth/login — Login", () => {
        test("logs in registered user with valid credentials, returns JWT + cookie, omits password", async () => {
            const { user: created, payload } = await registerTestUser({
                email: "login@example.com",
                password: "MyPassword123"
            });

            const res = await request(app).post("/api/auth/login").send({
                email: "login@example.com",
                password: payload.password
            });

            expect(res.status).toBe(200);
            expect(res.body.user).toEqual({
                _id: created._id,
                email: "login@example.com",
                name: created.name
            });
            expect(res.body.user.password).toBeUndefined();
            expect(res.body.password).toBeUndefined();
            expect(typeof res.body.token).toBe("string");

            const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
            expect(decoded.userId).toBe(created._id);

            const setCookieHeaders = res.headers["set-cookie"];
            expect(Array.isArray(setCookieHeaders)).toBe(true);
            expect(setCookieHeaders.some((c) => c.startsWith(`token=${res.body.token}`))).toBe(true);
        });

        test("rejects wrong password with 401 and returns no token", async () => {
            const { payload } = await registerTestUser({
                email: "wrongpass@example.com",
                password: "CorrectPassword123"
            });

            const res = await request(app).post("/api/auth/login").send({
                email: payload.email,
                password: "WrongPassword123"
            });

            expect(res.status).toBe(401);
            expect(res.body.token).toBeUndefined();
        });

        test("rejects unknown email with 401 and returns no token", async () => {
            const res = await request(app).post("/api/auth/login").send({
                email: "unknown@example.com",
                password: "SomePassword123"
            });

            expect(res.status).toBe(401);
            expect(res.body.token).toBeUndefined();
        });

        test("rejects missing email cleanly (400 or 401, not 500)", async () => {
            const res = await request(app).post("/api/auth/login").send({
                password: "SomePassword123"
            });

            expect([400, 401]).toContain(res.status);
        });

        test("rejects missing password cleanly (400 or 401, not 500)", async () => {
            await registerTestUser({
                email: "missingpass@example.com",
                password: "Password123"
            });

            const res = await request(app).post("/api/auth/login").send({
                email: "missingpass@example.com"
            });

            expect([400, 401]).toContain(res.status);
        });

        test("rejects NoSQL object payload in login email ($ne) with 400 validation error", async () => {
            await registerTestUser({ email: "target@example.com", password: "Password123" });

            const res = await request(app).post("/api/auth/login").send({
                email: { $ne: "" },
                password: "Password123"
            });

            expect(res.status).toBe(400);
        });

        test("rejects NoSQL object payload in login password ($ne) with 400 validation error", async () => {
            await registerTestUser({ email: "target2@example.com", password: "Password123" });

            const res = await request(app).post("/api/auth/login").send({
                email: "target2@example.com",
                password: { $ne: "" }
            });

            expect(res.status).toBe(400);
        });
    });

    describe("JWT Authentication Middleware & Protected Routes", () => {
        test("rejects protected route with 401 when no token is provided", async () => {
            const res = await request(app).get("/api/accounts/");
            expect(res.status).toBe(401);
        });

        test("allows access to protected route with valid Bearer token", async () => {
            const { token } = await registerTestUser();

            const res = await request(app)
                .get("/api/accounts/")
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.accounts)).toBe(true);
        });

        test("allows access to protected route with valid cookie token", async () => {
            const { token } = await registerTestUser();

            const res = await request(app)
                .get("/api/accounts/")
                .set("Cookie", [`token=${token}`]);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.accounts)).toBe(true);
        });

        test("rejects malformed JWT with 401", async () => {
            const res = await request(app)
                .get("/api/accounts/")
                .set("Authorization", "Bearer malformed.jwt.string");

            expect(res.status).toBe(401);
        });

        test("rejects forged JWT signed with wrong secret with 401", async () => {
            const forgedToken = jwt.sign(
                { userId: new mongoose.Types.ObjectId().toString() },
                "wrong-forged-secret",
                { expiresIn: "1h" }
            );

            const res = await request(app)
                .get("/api/accounts/")
                .set("Authorization", `Bearer ${forgedToken}`);

            expect(res.status).toBe(401);
        });

        test("rejects expired JWT with 401", async () => {
            const { user } = await registerTestUser();
            const expiredToken = jwt.sign(
                { userId: user._id },
                process.env.JWT_SECRET,
                { expiresIn: "-10s" }
            );

            const res = await request(app)
                .get("/api/accounts/")
                .set("Authorization", `Bearer ${expiredToken}`);

            expect(res.status).toBe(401);
        });

        test("rejects blacklisted JWT with 401 on both Bearer and cookie transport", async () => {
            const { token } = await registerTestUser();
            await tokenBlackListModel.create({ token });

            const bearerRes = await request(app)
                .get("/api/accounts/")
                .set("Authorization", `Bearer ${token}`);
            expect(bearerRes.status).toBe(401);

            const cookieRes = await request(app)
                .get("/api/accounts/")
                .set("Cookie", [`token=${token}`]);
            expect(cookieRes.status).toBe(401);
        });

        test("rejects JWT belonging to a deleted/nonexistent user with 401", async () => {
            const { user, token } = await registerTestUser();
            await userModel.deleteOne({ _id: user._id });

            const res = await request(app)
                .get("/api/accounts/")
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(401);
        });
    });

    describe("System-User Authorization (authSystemUserMiddleware)", () => {
        test("returns 401 when unauthenticated", async () => {
            const res = await request(app)
                .post("/api/transactions/system/initial-funds")
                .send({});

            expect(res.status).toBe(401);
        });

        test("returns 403 for normal authenticated user without systemUser privilege", async () => {
            const { token } = await registerTestUser();

            const res = await request(app)
                .post("/api/transactions/system/initial-funds")
                .set("Authorization", `Bearer ${token}`)
                .set("x-system-admin-key", process.env.SYSTEM_ADMIN_KEY)
                .send({});

            expect(res.status).toBe(403);
        });

        test("rejects system user with missing or invalid admin key (403) and returns 501 disabled with valid admin key", async () => {
            const sysUser = await createSystemUserInDb();
            const sysToken = jwt.sign({ userId: sysUser._id.toString() }, process.env.JWT_SECRET, {
                expiresIn: "1h"
            });

            const missingKeyRes = await request(app)
                .post("/api/transactions/system/initial-funds")
                .set("Authorization", `Bearer ${sysToken}`)
                .send({});
            expect(missingKeyRes.status).toBe(403);

            const wrongKeyRes = await request(app)
                .post("/api/transactions/system/initial-funds")
                .set("Authorization", `Bearer ${sysToken}`)
                .set("x-system-admin-key", "wrong-key-value")
                .send({});
            expect(wrongKeyRes.status).toBe(403);

            const validKeyRes = await request(app)
                .post("/api/transactions/system/initial-funds")
                .set("Authorization", `Bearer ${sysToken}`)
                .set("x-system-admin-key", process.env.SYSTEM_ADMIN_KEY)
                .send({});
            expect(validKeyRes.status).toBe(501);
        });
    });

    describe("POST /api/auth/logout — Logout & Token Blacklisting", () => {
        test("blacklists Bearer token in DB and denies subsequent protected requests", async () => {
            const { token } = await registerTestUser();

            const logoutRes = await request(app)
                .post("/api/auth/logout")
                .set("Authorization", `Bearer ${token}`);

            expect(logoutRes.status).toBe(200);

            const blacklistedDoc = await tokenBlackListModel.findOne({ token });
            expect(blacklistedDoc).not.toBeNull();
            expect(blacklistedDoc.token).toBe(token);

            const afterRes = await request(app)
                .get("/api/accounts/")
                .set("Authorization", `Bearer ${token}`);
            expect(afterRes.status).toBe(401);
        });

        test("blacklists cookie token, clears token cookie, and denies subsequent protected requests", async () => {
            const { token } = await registerTestUser();

            const logoutRes = await request(app)
                .post("/api/auth/logout")
                .set("Cookie", [`token=${token}`]);

            expect(logoutRes.status).toBe(200);
            const setCookieHeaders = logoutRes.headers["set-cookie"] || [];
            expect(setCookieHeaders.some((c) => c.startsWith("token=;"))).toBe(true);

            const blacklistedDoc = await tokenBlackListModel.findOne({ token });
            expect(blacklistedDoc).not.toBeNull();

            const afterRes = await request(app)
                .get("/api/accounts/")
                .set("Cookie", [`token=${token}`]);
            expect(afterRes.status).toBe(401);
        });

        test("repeat logout with the same token should handle gracefully without 500 error", async () => {
            const { token } = await registerTestUser();

            const firstRes = await request(app)
                .post("/api/auth/logout")
                .set("Authorization", `Bearer ${token}`);
            expect(firstRes.status).toBe(200);

            const secondRes = await request(app)
                .post("/api/auth/logout")
                .set("Authorization", `Bearer ${token}`);
            expect(secondRes.status).toBe(200);
        });
    });
});
