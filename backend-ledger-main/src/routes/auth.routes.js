const express = require("express");
const authController = require("../controllers/auth.controller");
const { createAuthLimiters } = require("../middleware/rateLimit.middleware");

const router = express.Router();
const { registerRateLimiter, loginRateLimiter, logoutRateLimiter } = createAuthLimiters();

/* POST /api/auth/register */
router.post("/register", registerRateLimiter, authController.userRegisterController);

/* POST /api/auth/login */
router.post("/login", loginRateLimiter, authController.userLoginController);

/**
 * - POST /api/auth/logout
 */
router.post("/logout", logoutRateLimiter, authController.userLogoutController);

module.exports = router;
