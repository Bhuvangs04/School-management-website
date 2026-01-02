import mongoose from "mongoose";


const DepartmentMemberSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: "College", required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, required: true },
    email: {
        type: String,
        required: true,
        index: true
    },

    role: {
        type: String,
        enum: ["HOD", "FACULTY", "HOD_ASSISTANT"],
        required: true
    },

    permissions: {
        type: [String],
        required: true
    },

    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    addedAt: { type: Date, default: Date.now },

    isActive: { type: Boolean, default: true }
});

DepartmentMemberSchema.index({ userId: 1, departmentId: 1 }, { unique: true });

export default mongoose.model("DepartmentMember", DepartmentMemberSchema);

