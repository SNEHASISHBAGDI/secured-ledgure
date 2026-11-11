const userModel = require("../models/user.model");
const jwt = require("jsonwebtoken");
const tokenBlackListModel = require("../models/blackList.model");

function extractRequestToken(req) {
    if (typeof req.cookies?.token === "string" && req.cookies.token.trim()) {
        return req.cookies.token.trim();
    }
    if (typeof req.headers.authorization === "string") {
        const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization.trim());
        if (match) {
            return match[1];
        }
    }
    return null;
}

function isValidObjectIdString(id) {
    return typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);
}

async function authenticateRequest(req, { requireSystemUser = false } = {}) {
    const token = extractRequestToken(req);

    if (!token) {
        return { ok: false, status: 401, message: "Unauthorized access, token is missing" };
    }

    const isBlacklisted = await tokenBlackListModel.findOne({ token });
    if (isBlacklisted) {
        return { ok: false, status: 401, message: "Unauthorized access, token is invalid" };
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return { ok: false, status: 401, message: "Unauthorized access, token is invalid" };
    }

    if (!decoded || !isValidObjectIdString(decoded.userId)) {
        return { ok: false, status: 401, message: "Unauthorized access, token is invalid" };
    }

    const query = userModel.findById(decoded.userId);
    if (requireSystemUser) {
        query.select("+systemUser");
    }

    const user = await query;
    if (!user) {
        return { ok: false, status: 401, message: "Unauthorized access, user not found" };
    }

    if (requireSystemUser && user.systemUser !== true) {
        return { ok: false, status: 403, message: "Forbidden access, not a system user" };
    }

    return { ok: true, user };
}

async function authMiddleware(req, res, next) {
    try {
        const result = await authenticateRequest(req, { requireSystemUser: false });
        if (!result.ok) {
            return res.status(result.status).json({ message: result.message });
        }
        req.user = result.user;
        return next();
    } catch (err) {
        return next(err);
    }
}

async function authSystemUserMiddleware(req, res, next) {
    try {
        const result = await authenticateRequest(req, { requireSystemUser: true });
        if (!result.ok) {
            return res.status(result.status).json({ message: result.message });
        }
        req.user = result.user;
        return next();
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    authMiddleware,
    authSystemUserMiddleware
};
