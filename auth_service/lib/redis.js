import IORedis from "ioredis";
import dotenv from "dotenv";
dotenv.config();

export const connection = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});

connection.on("connect", () => {
    console.log("[REDIS] Connected to server via URL");
});

connection.on("error", (err) => {
    console.error("[REDIS] Connection Error:", err);
});
