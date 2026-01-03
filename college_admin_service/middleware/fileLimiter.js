import multer from "multer";
import path from "path";
import fs from "fs";
import logger from "../utils/logger.js";
import { connection as redis } from "../lib/redis.js";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, UPLOAD_DIR),
    filename: (_, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
    }
});

const allowed = [".xlsx", ".xls", ".csv"];
const MAX_FILE_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 50 * 1024 * 1024);

const fileFilter = (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
        return cb(new Error("Only Excel/CSV allowed"), false);
    }
    cb(null, true);
};

export async function quotaMiddleware(req, res, next) {
    try {
        const ip = req.ip;
        const key = `upload_rate_limit:${ip}`;

        const current = await redis.incr(key);
        if (current === 1) await redis.expire(key, 60);

        if (current > 5) {
            logger.warn("Upload rate limit exceeded", {
                ip,
                requestId: req.requestId
            });

            return res.status(429).json({
                success: false,
                message: "Too many upload requests. Please try again later."
            });
        }

        next();
    } catch (err) {
        logger.warn("Upload quota check failed (fail-open)", {
            message: err.message,
            stack: err.stack
        });
        next();
    }
}

export default multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_FILE_BYTES }
});
