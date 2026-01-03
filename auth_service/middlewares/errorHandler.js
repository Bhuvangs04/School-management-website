import logger from "../utils/logger.js";

export const errorHandler = (err, req, res, next) => {
    logger.error("Unhandled error", {
        requestId: req.requestId,
        message: err.message,
        statusCode: err.statusCode || 500,
        stack: err.stack,
        path: req.originalUrl,
        method: req.method
    });

    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || "Internal Server Error",
        requestId: req.requestId
    });
};
