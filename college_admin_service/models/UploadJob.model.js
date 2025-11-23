import mongoose from "mongoose";

const UploadJobSchema = new mongoose.Schema({
    // collegeId: { type: mongoose.Schema.Types.ObjectId, ref: "College", required: true },
    collegeId: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    filePath: String,
    status: { type: String, enum: ["pending", "processing", "completed", "failed"], default: "pending" },
    totalRows: { type: Number, default: 0 },
    processed: { type: Number, default: 0 },
    succeeded: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    reportPath: String,
    error: String,
    createdAt: { type: Date, default: Date.now },
    completedAt: Date
});

export default mongoose.model("UploadJob", UploadJobSchema);
