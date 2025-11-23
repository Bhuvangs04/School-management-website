import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            trim: true
        },
        email: {
            type: String, required: true, unique: true, lowercase: true,
            trim: true
        },
        passwordHash: { type: String, required: true },
        role: { type: String, enum: ["super_admin", "college_admin", "teacher", "student", "parent"], required: true },
        collegeId: { type: String, default: null },
        studentId: { type: String, default: null },
        passwordChanged: { type: Boolean, default: false },
        resetOtp: { type: String, default: null },
        resetOtpExp: { type: Date, default: null },
        sessionsCount: { type: Number, default: 0 },
        lastLoginAt: { type: Date, default: null },
        parentOf: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }]
        
    },
    { timestamps: true }
);

export default mongoose.model("User", userSchema);
