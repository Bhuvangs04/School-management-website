import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            trim: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        phone: {
            type: String,
            default: null,
            trim: true
        },
        passwordHash: {
            type: String,
            required: true
        },
        status: { type: String, enum: ["ACTIVE", "DISABLED ", "DELETED"] },
        disabledReason: String,
        disabledUntil: Date,
        role: {
            type: String,
            enum: ["super_admin", "college_admin", "teacher", "student", "parent"],
            required: true
        },
        collegeId: {
            type: String,
            // ref: "College",
            default: null
        },
        code: {
            type: String,
            default: null
        },
        studentId: {
            type: String,
            default: null
        },
        passwordChanged: {
            type: Boolean,
            default: false
        },
        resetOtp: {
            type: String,
            default: null
        },
        resetOtpExp: {
            type: Date,
            default: null
        },
        sessionsCount: {
            type: Number,
            default: 0
        },
        lastLoginAt: {
            type: Date,
            default: null
        },
        parentOf: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ]
    },
    { timestamps: true }
);

export default mongoose.model("User", userSchema);
