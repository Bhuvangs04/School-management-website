import mongoose from "mongoose";

const DepartmentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    courses: [{ type: String }]
}, { _id: true });

const CollegeSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    code: { type: String, required: true, unique: true },
    address: String,
    contactEmail: String,
    contactNumber: String,
    status: {
        type: String,
        enum: ["ACTIVE", "DELETING", "DELETED"],
        default: "ACTIVE"
    },
    deletedAt: { type: Date, default: null },
    recoverUntil: { type: Date, default: null },
    allowedDomain: String,

    departments: {
        type: [DepartmentSchema],
        default: []
    },

    recoverToken: { type: String, default: null, index: true },
    recoverTokenExpiresAt: { type: Date, default: null },

    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("College", CollegeSchema);
