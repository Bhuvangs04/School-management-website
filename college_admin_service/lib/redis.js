import IORedis from "ioredis";
import dotenv from "dotenv";
import logger from "../utils/logger.js";

dotenv.config();

export const connection = new IORedis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
    connectTimeout: 10000,
    keepAlive: 10000
});

connection.on("connect", () => {
    logger.info("Redis connected", {
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: process.env.REDIS_PORT || 6379
    });
});

connection.on("ready", () => {
    logger.info("Redis ready");
});

connection.on("error", (err) => {
    logger.error("Redis connection error", {
        message: err.message,
        stack: err.stack
    });
});

export default connection;
