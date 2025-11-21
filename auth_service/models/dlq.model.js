import mongoose from "mongoose";
const schema = new mongoose.Schema({
    originalName: String,
    data: mongoose.Schema.Types.Mixed,
    failedReason: String,
    attemptsMade: Number,
    finishedAt: Date,
    createdAt: { type: Date, default: Date.now }
});
export default mongoose.model("DLQ", schema);
