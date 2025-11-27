import bcrypt from "bcrypt";
import User from "../models/user.model.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { blacklistJTI } from "../utils/redisBlacklist.js";
import RefreshSession from "../models/refreshSession.model.js";
import { generateAccessToken } from "../utils/jwt.js";
import { hashToken, createRefreshToken, generateJTI } from "../utils/crypto.js";
import { notificationQueue } from "../queues/notification.queue.js";
import { lookupGeo } from "../utils/geo.js"
import { computeRiskScore } from "../utils/risk.js"
import { v4 as uuidv4 } from "uuid";
import { metrics } from "../metrics/pm2.metrics.js";
import Audit from "../models/audit.model.js";
import { generateActionToken} from "../utils/actionToken.js";
import ActionToken from "../models/ActionToken.model.js";
import { validateCollege } from "./college.service.js";
import dotenv from "dotenv";
dotenv.config();


export const registerUser = async ({ name, email, password, role, collegeId }) => {
    let userExist = await User.findOne({ email });
    if (userExist) throw new Error("Email already exists");

    if (role === "college_admin") {
        if (!collegeId) throw new Error("College ID is required for college admin");
        console.log(collegeId)

        const college = await validateCollege(collegeId);
        console.log(college)
        if (!college) throw new Error("Invalid College ID");

        if (college.allowedDomain) {
            const emailDomain = email.split("@")[1];
            if (emailDomain !== college.allowedDomain) {
                throw new Error(`Email must be from ${college.allowedDomain}`);
            }
        }
    }

    const passwordHash = await bcrypt.hash(password, 10);

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
    const deviceId = crypto.randomUUID();

    const lastSessionPromise = RefreshSession.findOne({ userId: user._id })
        .sort({ createdAt: -1 })
        .lean()
        .exec();

    const geoPromise = lookupGeo(ip);

    const [lastSession, geo] = await Promise.all([lastSessionPromise, geoPromise]);

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

    const refreshToken = createRefreshToken();
    const refreshTokenHash = hashToken(refreshToken);
    const expiresDays = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || "7", 10);
    const expDate = new Date(Date.now() + expiresDays * 86400000);

    const sessionPromise = RefreshSession.create({
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

    const userUpdatePromise = User.updateOne(
        { _id: user._id },
        {
            $set: { lastLoginAt: new Date() },
            $inc: { sessionsCount: 1 }
        }
    );

    const [session] = await Promise.all([sessionPromise, userUpdatePromise]);

    metrics.sessionCreated.inc?.();

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

    if (!isFirstLogin && (riskScore > 0 && riskScore < 50 || !session.trusted)) {
        (async () => {
            try {
                const { token: approveToken, tokenId: approveTokenId } = generateActionToken({
                    userId: user._id,
                    deviceId: session.deviceId,
                    action: "approve_device"
                });

                await ActionToken.create({ tokenId: approveTokenId });
                const approveUrl = `${process.env.CLIENT_URL}/action/capture/?token=${approveToken}`;

                await notificationQueue.add("newDeviceEmail", {
                    userId: user._id,
                    email: user.email,
                    deviceId: session.deviceId,
                    geo: session.geo,
                    ip,
                    riskScore,
                    approveUrl
                }, {
                    attempts: 5,
                    backoff: { type: "exponential", delay: 1000 },
                    removeOnComplete: { age: 3600 }
                });
                metrics.newDeviceAlert.inc?.();
            } catch (err) {
                console.error("Background notification error", err);
            }
        })();
    }

    const accessToken = generateAccessToken(user, jti);

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

    const geoPromise = lookupGeo(ip);

    const sessionPromise = RefreshSession
        .findOne({ deviceId })
        .populate("userId", "email _id")
        .lean()
        .exec();

    const [geo, session] = await Promise.all([geoPromise, sessionPromise]);

    if (!session) {
        metrics.tokenReuseDetected.inc?.();
        throw new Error("Invalid session");
    }

    const user = session.userId;

    const handleSecurityEvent = async (type, currentSession, riskScore) => {
        try {
            if (type === 'REVOKED_ACCESS') {
                const { token: revokeToken, tokenId: revokeTokenId } = generateActionToken({
                    userId: user._id, deviceId: currentSession.deviceId, action: "revoke_device"
                });
                const { token: revokeAllToken, tokenId: revokeAllTokenId } = generateActionToken({
                    userId: user._id, action: "revoke_all"
                });

                await Promise.all([
                    ActionToken.create({ tokenId: revokeTokenId }),
                    ActionToken.create({ tokenId: revokeAllTokenId })
                ]);

                const revokeUrl = `${process.env.CLIENT_URL}/action/capture?token=${revokeToken}`;
                const revokeAllUrl = `${process.env.CLIENT_URL}/action/capture?token=${revokeAllToken}`;

                await notificationQueue.add("tokenReuseAlert", {
                    userId: user._id, email: user.email, deviceId: currentSession.deviceId,
                    geo: currentSession.geo, ip, riskScore, revokeUrl, revokeAllUrl
                }, {
                    attempts: 5, backoff: { type: "exponential", delay: 1000 }, removeOnComplete: { age: 3600 }
                });
            }
            else if (type === 'TOKEN_REUSE') {
                await RefreshSession.updateMany(
                    { userId: user._id },
                    { $set: { isRevoked: true, revokedAt: new Date() } }
                );
                const all = await RefreshSession.find({ userId: user._id }).lean();
                for (const s of all) if (s.jti) await blacklistJTI(s.jti, s.expiresAt);

                await handleSecurityEvent('REVOKED_ACCESS', currentSession, riskScore);
            }
        } catch (err) {
            console.error("Background security task failed:", err);
        }
    };

    if (session.isRevoked) {
        const riskScore = computeRiskScore({ geo, userAgent, ip, lastSession: session });
        try {
            if (session.jti) {
                const ttlSec = Math.max(1, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000));
                if (ttlSec > 0) await blacklistJTI(session.jti, ttlSec);
                await Audit.create({ userId: session.userId._id?.toString() || session.userId.toString(), event: "JTI_BLACKLISTED", metadata: { jti: session.jti, reason: "token_reuse" } });
            }
        } catch (err) {
            console.error("[SECURITY] failed to blacklist jti:", err);
        }        
        handleSecurityEvent('REVOKED_ACCESS', session, riskScore);
        metrics.tokenReuseDetected.inc?.();
        throw new Error("Session revoked. Possible token theft.");
    }

    if (new Date(session.expiresAt) < new Date()) {
        await RefreshSession.updateOne({ _id: session._id }, { isRevoked: true, revokedAt: new Date() });
        metrics.sessionRevoked.inc?.();
        throw new Error("Refresh token expired");
    }

    if (session.refreshTokenHash !== oldHash) {
        const riskScore = computeRiskScore({ geo, userAgent, ip, lastSession: session });

        try {
            if (session.jti) {
                const ttlSec = Math.max(1, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000));
                if (ttlSec > 0) await blacklistJTI(session.jti, ttlSec);
                await Audit.create({ userId: session.userId._id?.toString() || session.userId.toString(), event: "JTI_BLACKLISTED", metadata: { jti: session.jti, reason: "token_reuse" } });
            }
        } catch (err) {
            console.error("[SECURITY] failed to blacklist jti:", err);
        }
        handleSecurityEvent('TOKEN_REUSE', session, riskScore);

        metrics.tokenReuseDetected.inc?.();
        throw new Error("Refresh token reuse detected. All sessions revoked.");
    }


    const newRefreshToken = createRefreshToken();
    const newRefreshTokenHash = hashToken(newRefreshToken);
    const newJti = generateJTI();
    const expiresDays = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || "7", 10);
    const newExp = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

    await RefreshSession.updateOne(
        { _id: session._id },
        {
            $set: {
                refreshTokenHash: newRefreshTokenHash,
                expiresAt: newExp,
                lastUsedAt: new Date(),
                ip: ip,
                userAgent: userAgent,
                geo: geo,
                jti: newJti,
                riskScore: computeRiskScore({ geo, userAgent, ip, lastSession: session })
            }
        }
    );

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
        if (s.jti) await blacklistJTI(s.jti, s.expiresAt);

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

    await notificationQueue.add(
        "sendOtpEmail",
        {
            userId: user._id,
            email: user.email,
            otp
        },
        {
            attempts: 5,
            backoff: { type: "exponential", delay: 1000 },
            removeOnComplete: true,
            removeOnFail: false
        }
    );

    console.log("[QUEUE] OTP email job enqueued");

    metrics.otpRequests.inc();

    return true;
};


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

    console.log("Data:", token)

    let payload;
    try {
        console.log(process.env.JWT_SECRET)
        payload = jwt.verify(token, process.env.JWT_SECRET);
        console.log("PlayLoad", payload)
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

