import mongoose from "mongoose";

const ActionTokenSchema = new mongoose.Schema({
    tokenId: { type: String, required: true, index: true, unique: true },
    used: { type: Boolean, default: false },
    usedAt: Date,
    createdAt: { type: Date, default: Date.now },
    meta: mongoose.Schema.Types.Mixed
});

export default mongoose.model("ActionToken", ActionTokenSchema);
