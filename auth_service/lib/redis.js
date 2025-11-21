import IORedis from "ioredis";
import dotenv from "dotenv";
dotenv.config();


export const connection = new IORedis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});

connection.on("connect", () => {
    console.log("[REDIS] Connected to server", {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
    });
});

connection.on("error", (err) => {
    console.error("[REDIS] Connection Error:", err);
});
