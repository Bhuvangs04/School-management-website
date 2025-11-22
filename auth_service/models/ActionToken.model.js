import mongoose from "mongoose";

const actionTokenSchema = new mongoose.Schema({
    tokenId: { type: String, required: true, unique: true },
    used: { type: Boolean, default: false },
    usedAt: Date
}, { timestamps: true });

export default mongoose.model("ActionToken", actionTokenSchema);
