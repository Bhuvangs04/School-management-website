import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import RefreshSession from "../models/refreshSession.model.js";
import { generateAccessToken } from "../utils/jwt.js";
import { hashToken, createRefreshToken, generateJTI } from "../utils/crypto.js";
import { notificationQueue } from "../queues/notification.queue.js";
import nodemailer from "nodemailer";
import { lookupGeo } from "../utils/geo.js"
import { computeRiskScore } from "../utils/risk.js"
import { v4 as uuidv4 } from "uuid";
import { metrics } from "../metrics/pm2.metrics.js";
import Audit from "../models/audit.model.js";


export const registerUser = async ({ name, email, password, role, collegeId }) => {
    let userExist = await User.findOne({ email });
    if (userExist) throw new Error("Email already exists");

    const passwordHash = await bcrypt.hash(password, 13);

    const user = await User.create({
        name,
        email,
        passwordHash,
        role,
        collegeId,
        passwordChanged: false
    });

    metrics.usersRegistered.inc();


    return user;
};


export const loginUser = async ({ email, password, ip, userAgent }) => {
    metrics.loginAttempts.inc();

    const user = await User.findOne({ email });
    if (!user) {
        metrics.loginFailed.inc();
        throw new Error("Invalid credentials");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
        metrics.loginFailed.inc();
        throw new Error("Invalid credentials");
    }

    metrics.successfulLogins.inc();

    const jti = generateJTI();
    const accessToken = generateAccessToken(user, jti);

    const refreshToken = createRefreshToken();
    const refreshTokenHash = hashToken(refreshToken);
    const expiresDays = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || "7", 10);
    const expDate = new Date(Date.now() + expiresDays * 86400000);

    const deviceId = crypto.randomUUID();

    const lastSession = await RefreshSession.findOne({ userId: user._id })
        .sort({ createdAt: -1 })
        .lean();

    const geo = await lookupGeo(ip);

    const riskScore = computeRiskScore({
        geo,
        userAgent,
        ip,
        lastSession
    });

    const isFirstLogin = !lastSession;
    const trusted = isFirstLogin;
    const trustVerifiedAt = isFirstLogin ? new Date() : null;

    if (isFirstLogin) metrics.trustDevice.inc();

    const session = await RefreshSession.create({
        userId: user._id,
        refreshTokenHash,
        expiresAt: expDate,
        deviceId,
        ip,
        userAgent,
        geo,
        riskScore,
        trusted,
        trustVerifiedAt,
        jti
    });

    user.lastLoginAt = new Date();
    user.sessionsCount = (user.sessionsCount || 0) + 1;
    await user.save();

    metrics.sessionCreated.inc?.();

    if (!isFirstLogin && (riskScore > 0 && riskScore < 50 || !session.trusted)) {
        notificationQueue.add("newDeviceEmail", {
            userId: user._id,
            email: user.email,
            deviceId: session.deviceId,
            geo: session.geo,
            ip,
            riskScore
        }, {
            attempts: 5,
            backoff: { type: "exponential", delay: 1000 },
            removeOnComplete: { age: 60 * 60 },
            removeOnFail: false,
        });
        console.log("[QUEUE] Job added:", { name: "newDeviceEmail"});
        metrics.newDeviceAlert.inc?.();
    }

    if (riskScore > 80) {
        session.isRevoked = true;
        session.revokedAt = new Date();
        await session.save();

        await Audit.create({
            userId: user._id,
            event: "HIGH_RISK_LOGIN_BLOCKED",
            metadata: { ip, geo, riskScore }
        });
        throw new Error("Login blocked due to high risk");
    }

    return {
        user,
        accessToken,
        refreshToken,
        deviceId,
        refreshTokenExp: expDate,
        jti
    };
};



export const refreshAccessToken = async ({ refreshToken, deviceId, ip, userAgent }) => {
    if (!refreshToken) throw new Error("Refresh token required");
    if (!deviceId) throw new Error("Device ID missing");

    const oldHash = hashToken(refreshToken);

    const session = await RefreshSession
        .findOne({ deviceId })
        .populate("userId");

    if (!session) {
        metrics.tokenReuseDetected.inc?.();
        throw new Error("Invalid session");
    }

    const user = session.userId;

    const geo = await lookupGeo(ip);

    if (session.isRevoked) {
        const riskScore = computeRiskScore({ geo, userAgent, ip, lastSession: session });

        notificationQueue.add("tokenReuseAlert", {
            userId: user._id,
            email: user.email,
            deviceId: session.deviceId,
            geo: session.geo,
            ip,
            riskScore
        }, {
            attempts: 5,
            backoff: { type: "exponential", delay: 1000 },
            removeOnComplete: { age: 60 * 60 },
            removeOnFail: false,
        });

        console.log("[QUEUE] Job added:", { name: "tokenReuseAlert" });


        metrics.tokenReuseDetected.inc?.();
        throw new Error("Session revoked. Possible token theft.");
    }

    if (session.expiresAt < new Date()) {
        session.isRevoked = true;
        session.revokedAt = new Date();
        await session.save();

        metrics.sessionRevoked.inc?.();
        throw new Error("Refresh token expired");
    }

    if (session.refreshTokenHash !== oldHash) {

        await RefreshSession.updateMany(
            { userId: user._id },
            { $set: { isRevoked: true, revokedAt: new Date() } }
        );

        const riskScore = computeRiskScore({ geo, userAgent, ip, lastSession: session });

        notificationQueue.add("tokenReuseAlert", {
            userId: user._id,
            email: user.email,
            deviceId: session.deviceId,
            ip,
            geo: session.geo,
            riskScore
        }, {
            attempts: 3,
            backoff: { type: "fixed", delay: 2000 },
            removeOnComplete: { age: 60 * 60 }
        });

        console.log("[QUEUE] Job added:", { name: "tokenReuseAlert" });



        metrics.tokenReuseDetected.inc?.();
        throw new Error("Refresh token reuse detected. All sessions revoked.");
    }

    const newRefreshToken = createRefreshToken();
    const newRefreshTokenHash = hashToken(newRefreshToken);
    const newJti = generateJTI(); 
    const expiresDays = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || "7", 10);
    const newExp = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

    session.refreshTokenHash = newRefreshTokenHash;
    session.expiresAt = newExp;
    session.lastUsedAt = new Date();
    session.ip = ip;
    session.userAgent = userAgent;
    session.geo = geo;
    session.jti = newJti; 
    session.riskScore = computeRiskScore({ geo, userAgent, ip, lastSession: session });

    await session.save();

    const accessToken = generateAccessToken(user, newJti);

    return {
        accessToken,
        refreshToken: newRefreshToken,
        deviceId: session.deviceId,
        refreshTokenExp: newExp
    };
}


export const revokeRefreshTokenForUser = async (plainRefreshToken) => {
    if (!plainRefreshToken) return;
    const hashed = hashToken(plainRefreshToken);

    const sessions = await RefreshSession.find({ refreshTokenHash: hashed });
    if (!sessions || sessions.length === 0) return;

    for (const s of sessions) {
        s.isRevoked = true;
        await s.save();
    }
    return;
}



export const sendOtp = async (email) => {
    const user = await User.findOne({ email });
    if (!user) throw new Error("Email not registered");

    const otp = uuidv4().slice(0, 6).toUpperCase(); 

    user.resetOtp = otp;
    user.resetOtpExp = Date.now() + 10 * 60 * 1000; 
    await user.save();

    let transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS
        }
    });

    await transporter.sendMail({
        from: `"School App" <${process.env.MAIL_USER}>`,
        to: user.email,
        subject: "Password Reset OTP",
        text: `Your OTP is ${otp}. It expires in 10 minutes.`
    });

    metrics.otpRequests.inc();

    return true;
}


export const resetPassword = async (email, otp, newPassword) => {
    const user = await User.findOne({ email });
    if (!user) throw new Error("User not found");

    if (user.resetOtp !== otp) throw new Error("Invalid OTP");
    if (user.resetOtpExp < Date.now()) throw new Error("OTP expired");

    const newHash = await bcrypt.hash(newPassword, 13);

    user.passwordHash = newHash;
    user.passwordChanged = true;
    user.resetOtp = null;
    user.resetOtpExp = null;

    await user.save();

    metrics.passwordResets.inc();


    return true;
}



export const verifyAccessTokenAndGetUser = async (token) => {
    if (!token) throw new Error("No token provided");
    if (token.startsWith("Bearer ")) token = token.split(" ")[1];

    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        throw new Error("Invalid or expired token");
    }

    const user = await User.findById(payload.userId).select("-passwordHash -resetOtp -resetOtpExp -refreshToken");
    if (!user) throw new Error("User not found");

    return { payload, user };
}


export const changePassword = async ({ userId, oldPassword, newPassword }) => {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    if (user.passwordChanged) {
        if (!oldPassword) throw new Error("Old password required");
        const match = await bcrypt.compare(oldPassword, user.passwordHash);
        if (!match) throw new Error("Old password incorrect");
    }

    const newHash = await bcrypt.hash(newPassword, 13);
    user.passwordHash = newHash;
    user.passwordChanged = true;
    await user.save();

    return true;
};

