module.exports = {
    testEnvironment: "node",
    roots: ["<rootDir>/tests"],
    testMatch: ["**/*.test.js"],
    globalSetup: "<rootDir>/tests/globalSetup.js",
    globalTeardown: "<rootDir>/tests/globalTeardown.js",
    setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 30000,
    verbose: true,
    collectCoverageFrom: [
        "src/**/*.js"
    ],
    coverageThreshold: {
        global: {
            statements: 94,
            branches: 86,
            functions: 95,
            lines: 94
        }
    }
};
