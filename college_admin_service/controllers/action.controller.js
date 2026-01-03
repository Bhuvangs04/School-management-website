import { verifyActionToken } from "../utils/actionToken.js";
import ActionTokenModel from "../models/ActionToken.model.js";
import logger from "../utils/logger.js";

export const handleAction = async (req, res, next) => {
    const token = req.query.token || req.body.token;

    if (!token) {
        logger.warn("Missing action token", {
            requestId: req.requestId,
            path: req.originalUrl
        });

        const error = new Error("Missing token");
        error.statusCode = 400;
        return next(error);
    }

    try {
        const payload = verifyActionToken(token);
        const { jti, action } = payload;

        logger.info("Action token verified", {
            requestId: req.requestId,
            tokenId: jti,
            action
        });

        const tok = await ActionTokenModel.findOne({ tokenId: jti });

        if (!tok) {
            logger.warn("Action token not found", {
                requestId: req.requestId,
                tokenId: jti
            });

            const error = new Error("Action link invalid or expired");
            error.statusCode = 410;
            throw error;
        }

        if (tok.used) {
            logger.warn("Action token already used", {
                requestId: req.requestId,
                tokenId: jti,
                usedAt: tok.usedAt
            });

            const error = new Error("Action link already used");
            error.statusCode = 410;
            throw error;
        }

        // Mark token used
        tok.used = true;
        tok.usedAt = new Date();
        await tok.save();

        logger.info("Action token consumed", {
            requestId: req.requestId,
            tokenId: jti,
            action,
            usedAt: tok.usedAt
        });

        if (action === "one_time_set_password") {
            logger.info("Redirecting to set-password page", {
                requestId: req.requestId,
                tokenId: jti
            });

            return res.redirect(
                `${process.env.CLIENT_URL}/auth/set-password?token=${token}`
            );
        }

        return res.status(200).json({
            success: true,
            message: "Action completed",
            requestId: req.requestId
        });

    } catch (err) {
        err.statusCode = err.statusCode || 400;
        next(err);
    }
};
