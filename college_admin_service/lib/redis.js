import IORedis from "ioredis";
import dotenv from "dotenv";
dotenv.config();

export const connection = new IORedis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),

    enableReadyCheck: false,
    maxRetriesPerRequest: null,
    connectTimeout: 10000,
    keepAlive: 10000
});

connection.on("connect", () => {
    console.log("[REDIS] Connected to local Redis");
});

connection.on("ready", () => {
    console.log("[REDIS] Ready");
});

connection.on("error", (err) => {
    console.error("[REDIS] Error:", err.message);
});

export default connection;
