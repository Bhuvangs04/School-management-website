import IORedis from "ioredis";
import dotenv from "dotenv";
dotenv.config();

let redisHealthy = false;

export const connection = new IORedis(process.env.REDIS_URL, {
    // Render-safe config
    lazyConnect: false,
    enableReadyCheck: false,
    maxRetriesPerRequest: 1,     // DO NOT retry commands forever
    retryStrategy(times) {
        return Math.min(times * 200, 2000);
    },
    keepAlive: 10000,
    connectTimeout: 10000,
    enableOfflineQueue: false,   //  IMPORTANT
});

connection.on("ready", () => {
    redisHealthy = true;
    console.log("[REDIS] Ready");
});

connection.on("error", (err) => {
    redisHealthy = false;

    //  Ignore Render noise
    if (
        err?.message?.includes("Command timed out") ||
        err?.code === "ECONNRESET" ||
        err?.code === "ETIMEDOUT"
    ) {
        return;
    }

    console.error("[REDIS] Unexpected error:", err);
});

connection.on("close", () => {
    redisHealthy = false;
});

export function isRedisUp() {
    return redisHealthy;
}
