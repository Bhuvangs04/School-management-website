import logger from "../utils/logger.js";

logger.info("[QUEUE] Initializing queues...");
import BullMQ from "bullmq";
const { Queue } = BullMQ; 
import { connection } from "../lib/redis.js";

export const notificationQueue = new Queue("notificationQueue", { connection });
export const notificationDLQ = new Queue("notificationDLQ", { connection });
export const auditQueue = new Queue("auditQueue", { connection });

logger.info("[QUEUE] Queues ready:", {
    notificationQueue: "notificationQueue",
    notificationDLQ: "notificationDLQ",
    auditQueue: "auditQueue"
});
