import express from "express";
import { verifyActionToken } from "../utils/actionToken.js";
import RefreshSession from "../models/refreshSession.model.js";
import ActionToken from "../models/ActionToken.model.js";
import { blacklistJTI } from "../utils/redisBlacklist.js";

const router = express.Router();

router.get("/capture", async (req, res) => {
    try {
        const token = req.query.token;
        if (!token) return res.status(400).send("Missing token");

        const data = verifyActionToken(token);
        const { userId, deviceId, action, tokenId } = data;

        const record = await ActionToken.findOne({ tokenId });
        if (!record) return res.status(400).send("Invalid link");
        if (record.used) return res.status(410).send("This link has already been used");

        record.used = true;
        record.usedAt = new Date();
        await record.save();

        /* -------- APPROVE DEVICE -------- */
        if (action === "approve_device") {
            await RefreshSession.updateOne(
                { userId, deviceId },
                { $set: { trusted: true, trustVerifiedAt: new Date() } }
            );
            return res.send("Device approved successfully.");
        }

        /* -------- REVOKE SINGLE DEVICE -------- */
        if (action === "revoke_device") {
            const session = await RefreshSession.findOne({ userId, deviceId }).lean();

            if (session?.jti) {
                const ttlSec = Math.max(
                    60,
                    Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000)
                );
                await blacklistJTI(session.jti, ttlSec);
            }

            await RefreshSession.updateOne(
                { userId, deviceId },
                { $set: { isRevoked: true, revokedAt: new Date() } }
            );

            return res.send("Device revoked and logged out.");
        }

        /* -------- REVOKE ALL DEVICES (INSTANT LOGOUT) -------- */
        if (action === "revoke_all") {
            const sessions = await RefreshSession.find({ userId }).lean();

            for (const s of sessions) {
                if (s.jti) {
                    const ttlSec = Math.max(
                        60,
                        Math.floor((new Date(s.expiresAt).getTime() - Date.now()) / 1000)
                    );
                    await blacklistJTI(s.jti, ttlSec);
                }
            }

            await RefreshSession.updateMany(
                { userId },
                { $set: { isRevoked: true, revokedAt: new Date() } }
            );

            return res.send("All sessions revoked successfully.");
        }

        return res.status(400).send("Unknown action");

    } catch (err) {
        console.error("[ACTION_CAPTURE]", err);
        return res.status(401).send("Invalid or expired action link");
    }
});

export default router;
