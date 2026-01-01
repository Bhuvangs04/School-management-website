import mongoose from "mongoose";

const ProcessedEventSchema = new mongoose.Schema({
    eventId: { type: String, required: true, unique: true },
    type: { type: String, required: true },
    processedAt: { type: Date, default: Date.now }
});

export default mongoose.model("ProcessedEvent", ProcessedEventSchema);
