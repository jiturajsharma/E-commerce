    // middlewares/auth.middleware.js
    import jwt from "jsonwebtoken";
    import { asyncHandler } from "../utils/asyncHandler.js";
    import { ApiError } from "../utils/ApiError.js";
    import ApiResponse from "../utils/ApiResponse.js";
    import User from "../models/user.model.js";

    /**
     * Helpers & constants
     */
    const COOKIE_TOKEN_KEY = process.env.COOKIE_TOKEN_KEY || "JwtToken";
    const ROLES = {
    ADMIN: "admin",
    SELLER: "seller",
    USER: "user",
    };

    /**
     * Extracts JWT from cookies or Authorization header ("Bearer <token>")
     */
    function extractToken(req) {
    // cookie (if using cookie-parser)
    const cookieToken = req.cookies?.[COOKIE_TOKEN_KEY];
    if (cookieToken) return cookieToken;

    // Authorization header: "Bearer <token>"
    const authHeader = req.headers?.authorization;
    if (authHeader && typeof authHeader === "string") {
        const parts = authHeader.split(" ");
        if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
    }

    return null;
    }

    /**
     * Base verification middleware used by specific role checks.
     * Attaches `req.user` (without password) on success.
     */
    export const verifyUser = asyncHandler(async (req, _res, next) => {
    const token = extractToken(req);
    if (!token) {
        // use next with ApiError so centralized error handler formats response
        return next(new ApiError(401, "Unauthorized request: token missing"));
    }

    let payload;
    try {
        // jwt.verify throws on invalid/expired token
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        return next(new ApiError(401, `Unauthorized request: ${err.message}`));
    }

    // basic payload validation
    if (!payload || !payload._id) {
        return next(new ApiError(401, "Unauthorized request: invalid token payload"));
    }

    // fetch user and exclude password explicitly
    const user = await User.findById(payload._id).select("-password").lean();
    if (!user) {
        return next(new ApiError(401, "Unauthorized request: user not found"));
    }

    // attach sanitized user object
    req.user = user;

    return next();
    });

    /**
     * Ensure authenticated user is a seller
     */
    export const verifySeller = asyncHandler(async (req, _res, next) => {
    const user = req.user;
    if (!user) return next(new ApiError(401, "Unauthorized request"));

    if (user.userType !== ROLES.SELLER) {
        return next(new ApiError(403, "Access denied: seller role required"));
    }

    return next();
    });

    /**
     * Ensure authenticated user is an admin
     */
    export const verifyAdmin = asyncHandler(async (req, _res, next) => {
    const user = req.user;
    if (!user) return next(new ApiError(401, "Unauthorized request"));

    if (user.userType !== ROLES.ADMIN) {
        return next(new ApiError(403, "Access denied: admin role required"));
    }

    return next();
    });
