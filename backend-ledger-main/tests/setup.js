const mongoose = require("mongoose");

/**
 * Isolate email.service.js BEFORE any route/controller imports it so
 * nodemailer's transporter.verify() never runs network calls against Gmail.
 */
jest.mock("../src/services/email.service", () => ({
    sendRegistrationEmail: jest.fn().mockResolvedValue(undefined),
    sendTransactionEmail: jest.fn().mockResolvedValue(undefined),
    sendTransactionFailureEmail: jest.fn().mockResolvedValue(undefined)
}));

const userModel = require("../src/models/user.model");
const accountModel = require("../src/models/account.model");
const transactionModel = require("../src/models/transaction.model");
const ledgerModel = require("../src/models/ledger.model");
const tokenBlackListModel = require("../src/models/blackList.model");

function assertIsolatedTestUri(uri) {
    if (!uri || typeof uri !== "string") {
        throw new Error("MONGO_URI must be set by Jest globalSetup before running tests.");
    }
    if (uri.startsWith("mongodb+srv://")) {
        throw new Error("Refusing to run tests against a remote SRV/Atlas cluster URI.");
    }
    if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/secure-ledger-test/.test(uri)) {
        throw new Error(`Unsafe test database URI detected: ${uri}`);
    }
}

beforeAll(async () => {
    const uri = process.env.MONGO_URI;
    assertIsolatedTestUri(uri);

    await mongoose.connect(uri);

    // Ensure unique indexes (email, idempotencyKey, blacklisted token) exist before tests run.
    await Promise.all([
        userModel.init(),
        accountModel.init(),
        transactionModel.init(),
        ledgerModel.init(),
        tokenBlackListModel.init()
    ]);
});

afterEach(async () => {
    const { collections } = mongoose.connection;
    for (const key of Object.keys(collections)) {
        await collections[key].deleteMany({});
    }
    jest.clearAllMocks();
});

afterAll(async () => {
    await mongoose.disconnect();
});
