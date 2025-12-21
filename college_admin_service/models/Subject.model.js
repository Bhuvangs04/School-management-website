
import mongoose from "mongoose";

const SubjectSchema = new mongoose.Schema({
    name: { type: String, required: true },
    code: { type: String, required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, required: true },
    collegeId: { type: mongoose.Schema.Types.ObjectId, required: true },
    semester: { type: Number },
    createdAt: { type: Date, default: Date.now }
});

SubjectSchema.index({ code: 1, departmentId: 1 }, { unique: true });

export default mongoose.model("Subject", SubjectSchema);
