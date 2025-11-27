import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { isJtiBlacklisted } from "../utils/redisBlacklist.js";


export const authenticate = async (req, res, next) => {
    try {
        const auth = req.headers.authorization;
        console.log(auth)
        if (!auth) return res.status(401).json({ success: false, message: "Authorization header required" });

        let token = auth;
        if (auth.startsWith("Bearer ")) token = auth.split(" ")[1];

        const payload = jwt.verify(token, process.env.JWT_SECRET);
        if (payload?.jti) {
            const blocked = await isJtiBlacklisted(payload.jti);
            if (blocked) return res.status(401).json({ success: false, message: "Invalid token user" });
        }
        const user = await User.findById(payload.userId).select("-passwordHash -resetOtp -resetOtpExp -refreshToken");
        if (!user) return res.status(401).json({ success: false, message: "Invalid token user" });

        req.user = { id: user._id.toString(), role: user.role, collegeId: user.collegeId };
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: err.message });
    }
};


export const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ success: false, message: "Unauthenticated" });
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: "Forbidden: insufficient role" });
        }
        next();
    };
};
