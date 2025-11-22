import { Worker } from "bullmq";
import { connection } from "../lib/redis.js";
import Audit from "../models/audit.model.js";
import "../config/db.js";

new Worker("auditQueue", async job => {
    const { userId, event, metadata } = job.data;
    await Audit.create({ userId, event, metadata, createdAt: new Date() });
}, { connection, concurrency: 5 });
