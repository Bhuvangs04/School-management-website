import IORedis from "ioredis";
import dotenv from "dotenv";
dotenv.config();

export const connection = new IORedis(process.env.REDIS_URL, {
    // Connection retry strategy
    maxRetriesPerRequest: null,
    enableReadyCheck: false,

    // Socket configuration
    socket: {
        reconnectStrategy: (times) => {
            const delay = Math.min(times * 50, 2000); // Max 2 second delay
            console.log(`[REDIS] Reconnecting... (attempt ${times}, delay ${delay}ms)`);
            return delay;
        },
        keepAlive: 30000, // Send keep-alive every 30 seconds
        noDelay: true, // Disable Nagle's algorithm for faster writes
    },

    // Timeouts
    connectTimeout: 10000, // 10 seconds to connect
    commandTimeout: 5000, // 5 seconds per command

    // Connection pool
    lazyConnect: false, // Connect immediately

    // Retry on all errors
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },

    // Enable offline queue to buffer commands during disconnection
    enableOfflineQueue: true,

    // Max buffer size (in bytes) for commands
    maxRedisqlBufferSize: 1024 * 1024, // 1MB
});

// Connection events
connection.on("connect", () => {
    console.log("[REDIS] Connected to server via URL");
});

connection.on("ready", () => {
    console.log("[REDIS] Client ready and authenticated");
});

connection.on("error", (err) => {
    console.error("[REDIS] Connection Error:", {
        message: err.message,
        code: err.code,
        errno: err.errno,
        syscall: err.syscall,
    });
});

connection.on("reconnecting", (info) => {
    console.warn(`[REDIS] Reconnecting... (attempt ${info.attempt})`);
});

connection.on("close", () => {
    console.log("[REDIS] Connection closed");
});

connection.on("end", () => {
    console.log("[REDIS] Connection ended");
});

// Handle graceful shutdown
process.on("SIGINT", async () => {
    console.log("[REDIS] Closing connection...");
    await connection.quit();
    process.exit(0);
});

export default connection;
