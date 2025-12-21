import * as AuthService from "../services/auth.service.js";
import { normalizeIP } from "../utils/ip.js";


const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    path: "/", 
    maxAge: parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || "7", 10) * 24 * 60 * 60 * 1000
};

export const register = async (req, res) => {
    try {
        const user = await AuthService.registerUser(req.body);
        res.status(201).json({ success: true, user });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

export const login = async (req, res) => {
    try {
        const {email, password} = req.body;
        const ip = normalizeIP(req.ip);
        const userAgent = req.headers["user-agent"];
        const { user, accessToken, refreshToken, deviceId } = await AuthService.loginUser({ email, password, ip, userAgent });

        res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS);
        res.cookie("deviceId", deviceId, COOKIE_OPTIONS);


        return res.status(200).json({ success: true, user: { _id: user._id, email: user.email, role: user.role, collegeId: user.collegeId, passwordChanged: user.passwordChanged }, accessToken });
    } catch (err) {
        res.status(401).json({ success: false, message: err.message });
    }
};

export const refreshToken = async (req, res) => {
    try {
        const refreshToken = req.cookies?.refreshToken;
        const deviceId = req.cookies?.deviceId;

        const ip = normalizeIP(req.ip);
        const userAgent = req.headers["user-agent"];

        if (!refreshToken || !deviceId) {
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

        return res.status(200).json({
            success: true,
            accessToken: result.accessToken
        });

    } catch (err) {
        res.clearCookie("refreshToken");
        res.clearCookie("deviceId");

        return res.status(401).json({
            success: false,
            message: err.message
        });
    }
};


export const logout = async (req, res) => {
    const deviceId = req.cookies.deviceId;

    await RefreshSession.updateOne(
        { deviceId },
        { $set: { isRevoked: true } }
    );

    res.clearCookie("refreshToken");
    res.clearCookie("deviceId");

    return res.json({ success: true });
};

export const sendOtp = async (req, res) => {
    try {
        await AuthService.sendOtp(req.body.email);
        res.status(200).json({ success: true, message: "OTP sent to email" });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};


export const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        await AuthService.resetPassword(email, otp, newPassword);
        res.status(200).json({ success: true, message: "Password updated" });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};


export const verifyToken = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ message: "No token" });
        }

        const { payload, user } =
            await AuthService.verifyAccessTokenAndGetUser(authHeader);

        // 🔐 SEND IDENTITY VIA HEADERS (THIS IS THE KEY)
        res.setHeader("X-User-Id", user._id.toString());
        res.setHeader("X-User-Role", user.role);
        res.setHeader("X-College-Id", user.collegeId?.toString() || "");
        res.setHeader("X-JTI", payload.jti || "");

        // ✅ auth_request ONLY CARES ABOUT STATUS
        return res.sendStatus(200);

    } catch (err) {
        return res.sendStatus(401);
    }
};



export const changePassword = async (req, res) => {
    try {
        const { userId, oldPassword, newPassword } = req.body;
        if (!userId || !newPassword) return res.status(400).json({ success: false, message: "userId and newPassword required" });

        await AuthService.changePassword({ userId, oldPassword, newPassword });
        return res.status(200).json({ success: true, message: "Password updated" });
    } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
};


