import * as AuthService from "../services/auth.service.js";
import { normalizeIP } from "../utils/ip.js";
import logger from "../utils/logger.js";
import RefreshSession from "../models/refreshSession.model.js";

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: refreshDays * 24 * 60 * 60 * 1000
};

/* =========================
   REGISTER
========================= */
export const register = async (req, res, next) => {
    try {
        const user = await AuthService.registerUser(req.body);

        logger.info("User registered", {
            requestId: req.requestId,
            userId: user._id,
            email: user.email
        });

        res.status(201).json({ success: true, user });
    } catch (err) {
        logger.error("User registration failed", {
            requestId: req.requestId,
            message: err.message,
            stack: err.stack
        });

        res.status(400).json({ success: false, message: err.message });
    }
};

/* =========================
   LOGIN
========================= */
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const ip = normalizeIP(req.ip);
        const userAgent = req.headers["user-agent"];

        logger.info("Login attempt", {
            requestId: req.requestId,
            email,
            ip,
            userAgent
        });

        const { user, accessToken, refreshToken, deviceId } =
            await AuthService.loginUser({
                email,
                password,
                ip,
                userAgent
            });

        res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS);
        res.cookie("deviceId", deviceId, COOKIE_OPTIONS);

        logger.info("Login successful", {
            requestId: req.requestId,
            userId: user._id,
            role: user.role,
            collegeId: user.collegeId
        });

        res.status(200).json({
            success: true,
            user: {
                _id: user._id,
                email: user.email,
                role: user.role,
                collegeId: user.collegeId,
                passwordChanged: user.passwordChanged
            },
            accessToken
        });
    } catch (err) {
        logger.warn("Login failed", {
            requestId: req.requestId,
            email: req.body?.email,
            message: err.message
        });

        res.status(401).json({ success: false, message: err.message });
    }
};

/* =========================
   REFRESH TOKEN
========================= */
export const refreshToken = async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken;
        const deviceId = req.cookies?.deviceId;

        const ip = normalizeIP(req.ip);
        const userAgent = req.headers["user-agent"];

        if (!refreshToken || !deviceId) {
            logger.warn("Refresh token missing", {
                requestId: req.requestId,
                ip
            });

            return res.status(401).json({
                success: false,
                message: "Refresh token missing"
            });
        }

        const result = await AuthService.refreshAccessToken({
            refreshToken,
            deviceId,
            ip,
            userAgent
        });

        res.cookie("refreshToken", result.refreshToken, COOKIE_OPTIONS);
        res.cookie("deviceId", result.deviceId, COOKIE_OPTIONS);

        logger.info("Access token refreshed", {
            requestId: req.requestId,
            deviceId
        });

        res.status(200).json({
            success: true,
            accessToken: result.accessToken
        });
    } catch (err) {
        logger.error("Refresh token failed", {
            requestId: req.requestId,
            message: err.message,
            stack: err.stack
        });

        res.clearCookie("refreshToken");
        res.clearCookie("deviceId");

        res.status(401).json({
            success: false,
            message: err.message
        });
    }
};

/* =========================
   LOGOUT
========================= */
export const logout = async (req, res) => {
    try {
        const deviceId = req.cookies.deviceId;

        await RefreshSession.updateOne(
            { deviceId },
            { $set: { isRevoked: true } }
        );

        res.clearCookie("refreshToken");
        res.clearCookie("deviceId");

        logger.info("User logged out", {
            requestId: req.requestId,
            deviceId
        });

        res.json({ success: true });
    } catch (err) {
        logger.error("Logout failed", {
            requestId: req.requestId,
            message: err.message
        });

        res.status(500).json({ success: false });
    }
};

/* =========================
   SEND OTP
========================= */
export const sendOtp = async (req, res) => {
    try {
        await AuthService.sendOtp(req.body.email);

        logger.info("OTP sent", {
            requestId: req.requestId,
            email: req.body.email
        });

        res.status(200).json({ success: true, message: "OTP sent to email" });
    } catch (err) {
        logger.error("Send OTP failed", {
            requestId: req.requestId,
            email: req.body?.email,
            message: err.message
        });

        res.status(400).json({ success: false, message: err.message });
    }
};

/* =========================
   RESET PASSWORD
========================= */
export const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        await AuthService.resetPassword(email, otp, newPassword);

        logger.info("Password reset successful", {
            requestId: req.requestId,
            email
        });

        res.status(200).json({ success: true, message: "Password updated" });
    } catch (err) {
        logger.warn("Password reset failed", {
            requestId: req.requestId,
            email: req.body?.email,
            message: err.message
        });

        res.status(400).json({ success: false, message: err.message });
    }
};

/* =========================
   VERIFY TOKEN (NGINX auth_request)
========================= */
export const verifyToken = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.sendStatus(401);

        const { payload, user } =
            await AuthService.verifyAccessTokenAndGetUser(authHeader);

        res.setHeader("X-User-Id", user._id.toString());
        res.setHeader("X-User-Role", user.role);
        res.setHeader("X-College-Id", user.collegeId?.toString() || "");
        res.setHeader("X-JTI", payload.jti || "");

        logger.info("Token verified", {
            requestId: req.requestId,
            userId: user._id,
            role: user.role
        });

        return res.sendStatus(204);
    } catch (err) {
        logger.warn("Token verification failed", {
            requestId: req.requestId,
            message: err.message
        });

        return res.sendStatus(401);
    }
};

/* =========================
   CHANGE PASSWORD
========================= */
export const changePassword = async (req, res) => {
    try {
        const { userId, oldPassword, newPassword } = req.body;
        if (!userId || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "userId and newPassword required"
            });
        }

        await AuthService.changePassword({
            userId,
            oldPassword,
            newPassword
        });

        logger.info("Password changed", {
            requestId: req.requestId,
            userId
        });

        res.status(200).json({
            success: true,
            message: "Password updated"
        });
    } catch (err) {
        logger.warn("Change password failed", {
            requestId: req.requestId,
            userId: req.body?.userId,
            message: err.message
        });

        res.status(400).json({
            success: false,
            message: err.message
        });
    }
};
