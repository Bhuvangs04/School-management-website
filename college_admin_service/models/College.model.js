import mongoose from "mongoose";

const DepartmentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    hod: String,
    courses: [{ type: String }]
});

const CollegeSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    code: { type: String, required: true, unique: true },
    address: String,
    contactEmail: String,
    contactNumber: String,
    status: { type: String, enum: ["ACTIVE", "DELETING", "DELETED"] },
    deletedAt: { type: Date, default: null },
    recoverUntil: { type: Date, default: null },
    allowedDomain: { type: String },
    departments: {
        type: [DepartmentSchema],
        default: []
    },
    RecoverToken: {
        type: String, default: null, index: true
    },
    recoverTokenExpiresAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("College", CollegeSchema);
