import { Worker } from "bullmq";
import { connection } from "../lib/redis.js";
import DLQRecord from "../models/dlq.model.js";
import "../config/db.js";


new Worker("notificationDLQ", async job => {
    console.warn("DLQ job:", job.data);
    await DLQRecord.create({
        originalName: job.data.originalName,
        data: job.data.data,
        failedReason: job.data.failedReason,
        attemptsMade: job.data.attemptsMade,
        finishedAt: job.data.finishedAt
    });
}, { connection });
