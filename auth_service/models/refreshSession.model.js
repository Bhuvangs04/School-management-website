import mongoose from "mongoose";

const refreshSessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    refreshTokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    jti: { type: String, required: true }, 
    deviceId: { type: String, required: true },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    geo: {
        country: { type: String, default: null },
        region: { type: String, default: null },
        city: { type: String, default: null }
    },

    createdAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date, default: Date.now },

    isRevoked: { type: Boolean, default: false },
    revokedAt: { type: Date, default: null },

    trusted: { type: Boolean, default: false },
    trustVerifiedAt: { type: Date, default: null },

    riskScore: { type: Number, default: 0 }, 

}, { timestamps: true });

export default mongoose.model("RefreshSession", refreshSessionSchema);
