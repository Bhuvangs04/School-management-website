import { verifyActionToken } from "../utils/actionToken.js";
import ActionTokenModel from "../models/ActionToken.model.js";
import User from "../models/User.model.js";

export const handleAction = async (req, res, next) => {
    const token = req.query.token || req.body.token;
    if (!token) {
        const error = new Error("Missing token");
        error.statusCode = 400;
        return next(error);
    }

    try {
        const payload = verifyActionToken(token);
        const { jti } = payload;
        const tok = await ActionTokenModel.findOne({ tokenId: jti });
        if (!tok) {
            const error = new Error("Action link invalid or used");
            error.statusCode = 410;
            throw error;
        }
        if (tok.used) {
            const error = new Error("Action link already used");
            error.statusCode = 410;
            throw error;
        }

        // mark used
        tok.used = true;
        tok.usedAt = new Date();
        await tok.save();

        // For set-password action: redirect to frontend page with token (or allow same endpoint to accept new password)
        if (payload.action === "one_time_set_password") {
            // If you want to allow password setting via this endpoint:
            return res.redirect(`${process.env.CLIENT_URL}/auth/set-password?token=${token}`);
        }

        return res.send("Action completed");
    } catch (err) {
        if (!err.statusCode) err.statusCode = 400;
        err.message = "Invalid or expired token";
        next(err);
    }
};
