import express from "express";
import { verifyActionToken } from "../utils/actionToken.js";
import RefreshSession from "../models/refreshSession.model.js";
import ActionToken from "../models/ActionToken.model.js";

const router = express.Router();

router.get("/action", async (req, res) => {
    try {
        const token = req.query.token;
        if (!token) return res.status(400).send("Missing token");

        const data = verifyActionToken(token);
        const { userId, deviceId, action, tokenId } = data;

        const record = await ActionToken.findOne({ tokenId });
        if (!record) return res.status(400).send("Invalid link");
        if (record.used)
            return res.status(410).send("This link has already been used");

        record.used = true;
        record.usedAt = new Date();
        await record.save();

        if (action === "approve_device") {
            await RefreshSession.updateOne(
                { userId, deviceId },
                { $set: { trusted: true, trustVerifiedAt: new Date() } }
            );
            return res.send("Device approved successfully.");
        }

        if (action === "revoke_device") {
            await RefreshSession.updateOne(
                { userId, deviceId },
                { $set: { isRevoked: true, revokedAt: new Date() } }
            );
            return res.send("Device revoked and logged out.");
        }

        if (action === "revoke_all") {
            await RefreshSession.updateMany(
                { userId },
                { $set: { isRevoked: true, revokedAt: new Date() } }
            );
            return res.send("All sessions revoked successfully.");
        }

        return res.status(400).send("Unknown action");

    } catch (err) {
        return res.status(401).send("Invalid or expired action link");
    }
});

export default router;
