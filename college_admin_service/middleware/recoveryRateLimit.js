import { connection as redis, isRedisUp } from "../lib/redis.js";

export const recoveryRateLimit = ({
    windowSec = 15 * 60,
    maxAttempts = 5
} = {}) => {
    return async (req, res, next) => {
        const token = req.query.token || req.body.token;
        const ip = req.ip;

        if (!token) {
            return res.status(400).json({ message: "Missing recovery token" });
        }

        // Redis unhealthy → fail open
        if (!isRedisUp()) {
            return next();
        }

        const key = `recover:${token}:${ip}`;

        // Fire-and-forget Redis ops
        redis.incr(key)
            .then((attempts) => {
                if (attempts === 1) {
                    redis.expire(key, windowSec).catch(() => { });
                }

                if (attempts > maxAttempts) {
                    return res.status(429).json({
                        message: "Too many recovery attempts. Please try later."
                    });
                }

                next();
            })
            .catch(() => {
                //  Ignore Redis errors completely
                next();
            });
    };
};
