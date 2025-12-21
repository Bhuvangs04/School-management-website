import mongoose from "mongoose";

const DepartmentMemberSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: "College", required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, required: true },

    role: {
        type: String,
        enum: ["HOD", "FACULTY", "ASSISTANT"],
        required: true
    },

    permissions: { type: Object, required: true },

    createdAt: { type: Date, default: Date.now }
});

DepartmentMemberSchema.index({ userId: 1, departmentId: 1 }, { unique: true });

export default mongoose.model("DepartmentMember", DepartmentMemberSchema);
