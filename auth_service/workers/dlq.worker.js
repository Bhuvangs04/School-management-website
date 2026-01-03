import { Worker } from "bullmq";
import { connection } from "../lib/redis.js";
import DLQRecord from "../models/dlq.model.js";
import "../config/db.js";
import logger from "../utils/logger.js";

new Worker(
    "notificationDLQ",
    async (job) => {
        try {
            logger.warn("DLQ job received", {
                category: "dlq",
                queue: "notificationDLQ",
                jobId: job.id,
                originalName: job.data?.originalName,
                attemptsMade: job.attemptsMade
            });

            await DLQRecord.create({
                originalName: job.data.originalName,
                data: job.data.data,
                failedReason: job.data.failedReason,
                attemptsMade: job.attemptsMade,
                finishedAt: job.finishedOn
            });

            logger.info("DLQ record persisted", {
                category: "dlq",
                queue: "notificationDLQ",
                jobId: job.id
            });
        } catch (err) {
            logger.error("DLQ persistence failed", {
                category: "dlq",
                queue: "notificationDLQ",
                jobId: job?.id,
                message: err.message,
                stack: err.stack
            });

            throw err;
        }
    },
    { connection }
);

logger.info("notificationDLQ worker started", {
    category: "worker",
    queue: "notificationDLQ"
});
