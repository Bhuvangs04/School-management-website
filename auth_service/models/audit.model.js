import mongoose from "mongoose";

const schema = new mongoose.Schema({
    userId: { type: String, required: true },
    event: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Audit", schema);
