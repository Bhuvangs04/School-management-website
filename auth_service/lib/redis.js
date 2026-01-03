import IORedis from "ioredis";
import dotenv from "dotenv";
import logger from "../utils/logger";
dotenv.config();

export const connection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});

connection.on("connect", () => {
    logger.info("[REDIS] Connected to server via URL");
});

connection.on("error", (err) => {
    logger.error("[REDIS] Connection Error:", err);
});
