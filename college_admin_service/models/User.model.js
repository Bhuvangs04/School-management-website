import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, index: true, unique: true },
    role: { type: String, enum: ["college_admin", "student", "parent", "teacher", "super_admin"], required: true },
    // collegeId: { type: mongoose.Schema.Types.ObjectId, ref: "College" },
    collegeId: { type:String },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
    parentOf: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("User", UserSchema);
