import mongoose from "mongoose";

const AuditSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId },
    event: String,
    metadata: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Audit", AuditSchema);
