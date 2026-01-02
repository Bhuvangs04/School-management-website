import mongoose from "mongoose";

const DepartmentMemberSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    name: {
        type: String,
        required: true,
        index: true
    },

    collegeId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },

    departmentId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },

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
        default: []
    },

    addedBy: {
        type: mongoose.Schema.Types.ObjectId
    },

    addedAt: {
        type: Date,
        default: Date.now
    },

    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

/* Prevent duplicate assignment */
DepartmentMemberSchema.index(
    { userId: 1, departmentId: 1 },
    { unique: true }
);

/* Enforce ONE active HOD per department (concurrency-safe) */
DepartmentMemberSchema.index(
    { collegeId: 1, departmentId: 1, role: 1 },
    {
        unique: true,
        partialFilterExpression: {
            role: "HOD",
            isActive: true
        }
    }
);

export default mongoose.model("DepartmentMember", DepartmentMemberSchema);
