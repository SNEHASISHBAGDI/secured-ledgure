/**
 * Global Jest teardown:
 * Stops the in-memory MongoDB Replica Set cleanly so Jest exits with zero open handles.
 */
module.exports = async function globalTeardown() {
    if (globalThis.__MONGO_REPLSET__) {
        await globalThis.__MONGO_REPLSET__.stop({ doCleanup: true });
    }
};
