import { randomUUID } from "crypto";
import logger from "../utils/logger.js";

export const requestLogger = (req, res, next) => {
    req.requestId = randomUUID();

    logger.info("Incoming request", {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        userAgent: req.headers["user-agent"]
    });

    const start = Date.now();

    res.on("finish", () => {
        logger.info("Request completed", {
            requestId: req.requestId,
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            durationMs: Date.now() - start
        });
    });

    next();
};
