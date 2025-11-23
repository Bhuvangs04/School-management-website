import multer from "multer";
import path from "path";
import fs from "fs";
import logger from "../utils/logger.js";
import IORedis from "ioredis";

// disk storage (we may move to S3 in production)
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
    }
});

const allowed = [".xlsx", ".xls", ".csv"];
const MAX_FILE_BYTES = parseInt(process.env.MAX_UPLOAD_BYTES || `${50 * 1024 * 1024}`, 10); // default 50MB

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) return cb(new Error("Only Excel/CSV allowed"), false);
    cb(null, true);
};

// Redis connection for rate limiting
const redis = new IORedis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT || "6379", 10)
});

// Rate Limiting Middleware
async function quotaMiddleware(req, res, next) {
    try {
        const ip = req.ip;
        const key = `upload_rate_limit:${ip}`;
        
        // Allow 5 uploads per minute per IP
        const current = await redis.incr(key);
        if (current === 1) {
            await redis.expire(key, 60);
        }

        if (current > 5) {
            logger.warn(`Rate limit exceeded for IP ${ip}`);
            return res.status(429).json({ success: false, message: "Too many upload requests. Please try again later." });
        }

        next();
    } catch (err) {
        logger.warn("Quota check failed", err);
        // Fail open if Redis is down, or fail closed? Fail open for now to not block users.
        next();
    }
}

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_FILE_BYTES }
});

export { quotaMiddleware };
export default upload;
