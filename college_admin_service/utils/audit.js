import Audit from "../models/Audit.model.js";
export async function createAudit(userId, event, metadata = {}) {
    try {
        await Audit.create({ userId, event, metadata, createdAt: new Date() });
    } catch (err) {
        console.error("Audit save failed", err);
    }
}
