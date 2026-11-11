const userModel = require("../models/user.model");
const jwt = require("jsonwebtoken");
const emailService = require("../services/email.service");
const tokenBlackListModel = require("../models/blackList.model");
const { validateRegisterPayload, validateLoginPayload } = require("../utils/authValidation");

function getAuthCookieOptions() {
    const isProduction = process.env.NODE_ENV === "production";
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 3 * 24 * 60 * 60 * 1000 // Matches 3d JWT lifetime
    };
}

function getClearCookieOptions() {
    const isProduction = process.env.NODE_ENV === "production";
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax"
    };
}

function extractBearerToken(authHeader) {
    if (typeof authHeader !== "string") {
        return null;
    }
    const match = /^Bearer\s+(\S+)$/i.exec(authHeader.trim());
    return match ? match[1] : null;
}

/**
 * - user register controller
 * - POST /api/auth/register
 */
async function userRegisterController(req, res, next) {
    try {
        const validation = validateRegisterPayload(req.body);
        if (!validation.valid) {
            return res.status(400).json({
                message: validation.error,
                status: "failed"
            });
        }

        const { email, password, name } = validation.data;

        const isExists = await userModel.findOne({ email });
        if (isExists) {
            return res.status(422).json({
                message: "User already exists with email.",
                status: "failed"
            });
        }

        // Explicitly construct user from validated primitives only (prevents mass assignment)
        const user = await userModel.create({
            email,
            password,
            name
        });

        const token = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: "3d" });

        res.cookie("token", token, getAuthCookieOptions());

        res.status(201).json({
            user: {
                _id: user._id,
                email: user.email,
                name: user.name
            },
            token
        });

        try {
            await emailService.sendRegistrationEmail(user.email, user.name);
        } catch (emailErr) {
            console.error("Non-fatal registration email failure:", emailErr.message);
        }
    } catch (err) {
        if (err && (err.code === 11000 || (err.name === "MongoServerError" && err.code === 11000))) {
            return res.status(422).json({
                message: "User already exists with email.",
                status: "failed"
            });
        }
        return next(err);
    }
}

/**
 * - User Login Controller
 * - POST /api/auth/login
 */
async function userLoginController(req, res, next) {
    try {
        const validation = validateLoginPayload(req.body);
        if (!validation.valid) {
            return res.status(400).json({
                message: validation.error
            });
        }

        const { email, password } = validation.data;

        const user = await userModel.findOne({ email }).select("+password");

        if (!user) {
            return res.status(401).json({
                message: "Email or password is INVALID"
            });
        }

        const isValidPassword = await user.comparePassword(password);

        if (!isValidPassword) {
            return res.status(401).json({
                message: "Email or password is INVALID"
            });
        }

        const token = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: "3d" });

        res.cookie("token", token, getAuthCookieOptions());

        return res.status(200).json({
            user: {
                _id: user._id,
                email: user.email,
                name: user.name
            },
            token
        });
    } catch (err) {
        return next(err);
    }
}

/**
 * - User Logout Controller
 * - POST /api/auth/logout
 */
async function userLogoutController(req, res, next) {
    try {
        const cookieToken = typeof req.cookies?.token === "string" && req.cookies.token.trim()
            ? req.cookies.token.trim()
            : null;
        const headerToken = extractBearerToken(req.headers.authorization);

        const candidateTokens = [...new Set([cookieToken, headerToken].filter(Boolean))];

        for (const token of candidateTokens) {
            let verifiedPayload = null;
            try {
                // Allow blacklisting valid-signature tokens even if nearing/past expiration
                verifiedPayload = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
            } catch {
                verifiedPayload = null;
            }

            if (verifiedPayload) {
                try {
                    await tokenBlackListModel.findOneAndUpdate(
                        { token },
                        { $setOnInsert: { token } },
                        { upsert: true }
                    );
                } catch (err) {
                    // Concurrent logout race on unique index is safe to ignore cleanly
                    if (!(err && (err.code === 11000 || (err.name === "MongoServerError" && err.code === 11000)))) {
                        throw err;
                    }
                }
            }
        }

        res.clearCookie("token", getClearCookieOptions());

        return res.status(200).json({
            message: "User logged out successfully"
        });
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    userRegisterController,
    userLoginController,
    userLogoutController
};
