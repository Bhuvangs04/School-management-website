import { connection as redis } from "../lib/redis.js";

export const recoveryRateLimit = ({
    windowSec = 15 * 60,  
    maxAttempts = 5
} = {}) => {
    return async (req, res, next) => {
        try {
            const token = req.query.token || req.body.token;
            const ip = req.ip;

            if (!token) {
                return res.status(400).json({ message: "Missing recovery token" });
            }

            const key = `recover:${token}:${ip}`;
            const attempts = await redis.incr(key);

            if (attempts === 1) {
                await redis.expire(key, windowSec);
            }

            if (attempts > maxAttempts) {
                return res.status(429).json({
                    message: "Too many recovery attempts. Please try later."
                });
            }

            next();
        } catch (err) {
            console.error("[RATE_LIMIT] Error:", err.message);
            return res.status(500).json({ message: "Rate limit error" });
        }
    };
};
