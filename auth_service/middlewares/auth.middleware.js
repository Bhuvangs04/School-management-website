import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { isJtiBlacklisted } from "../utils/redisBlacklist.js";

function getJWTSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is missing");
    }
    return secret;
}

export const authenticate = async (req, res, next) => {
    try {
        const auth = req.headers.authorization;

        if (!auth || !auth.startsWith("Bearer ")) {
            return res.status(401).json({ success: false, message: "Token missing" });
        }

        const token = auth.split(" ")[1];

        let payload;
        try {
            payload = jwt.verify(token, getJWTSecret());
            console.log(payload);
        } catch (e) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        if (payload?.jti) {
            const blocked = await isJtiBlacklisted(payload.jti);
            if (blocked) {
                return res.status(401).json({ success: false, message: "Unauthorized" });
            }
        }

        const user = await User.findById(payload.userId)
            .select("-passwordHash -resetOtp -resetOtpExp -refreshToken");

        if (!user) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        req.user = {
            id: user._id.toString(),
            role: user.role,
            collegeId: user.collegeId
        };

        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
};
