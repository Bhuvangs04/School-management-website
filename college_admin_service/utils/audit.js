import Audit from "../models/Audit.model.js";
import logger from "./logger.js";

export async function createAudit(userId, event, metadata = {}) {
    try {
        await Audit.create({
            userId,
            event,
            metadata,
            createdAt: new Date()
        });
    } catch (err) {
        logger.error("Audit creation failed", {
            userId,
            event,
            message: err.message,
            stack: err.stack
        });
    }
}
