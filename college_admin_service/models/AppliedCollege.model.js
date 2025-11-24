import mongoose from "mongoose";

const AppliedCollegeSchema = new mongoose.Schema({
    collegeName: { type: String, required: true },
    officialWebsite: { type: String, required: true },
    requestedBy: {
        name: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String, required: true }
    },
    status: {
        type: String,
        enum: ["pending", "email_verified", "approved", "rejected"],
        default: "pending"
    },
    allowedDomain: { type: String, default:null},
    verificationToken: { type: String },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("AppliedCollege", AppliedCollegeSchema);
