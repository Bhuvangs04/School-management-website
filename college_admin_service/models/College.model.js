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
    departments: [DepartmentSchema],
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("College", CollegeSchema);
