const fs = require("fs");
const path = require("path");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

/**
 * Global Jest setup:
 * Starts an isolated single-node MongoDB Replica Set so multi-document ACID
 * transactions (mongoose.startSession / startTransaction) are supported without
 * touching any developer or production Atlas database.
 */
module.exports = async function globalSetup() {
    const localPkgBinDir = path.resolve(
        __dirname,
        "../node_modules/mongodb-memory-server/mongodb-binaries"
    );
    const hasLocalPkgBinary =
        fs.existsSync(localPkgBinDir) &&
        fs.readdirSync(localPkgBinDir).some((file) => file.startsWith("mongod-") && !file.endsWith(".md5"));

    const replSet = await MongoMemoryReplSet.create({
        ...(hasLocalPkgBinary ? { binary: { downloadDir: localPkgBinDir } } : {}),
        replSet: {
            name: "secure-ledger-test-rs",
            count: 1,
            storageEngine: "wiredTiger"
        }
    });

    const uri = replSet.getUri("secure-ledger-test");

    process.env.MONGO_URI = uri;
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "test-only-jwt-secret-key-for-jest";
    process.env.SYSTEM_ADMIN_KEY = "test-only-system-admin-key-for-jest";

    globalThis.__MONGO_REPLSET__ = replSet;
};
