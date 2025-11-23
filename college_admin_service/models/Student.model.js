import mongoose from "mongoose";

const StudentSchema = new mongoose.Schema({
    collegeId: { type: String },
    rollNumber: { type: String, required: true },
    name: { type: String, required: true },
    dob: Date,
    class: String,
    section: String,
    parents: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    meta: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now }
});

StudentSchema.index({ collegeId: 1, rollNumber: 1 }, { unique: true });

export default mongoose.model("Student", StudentSchema);
