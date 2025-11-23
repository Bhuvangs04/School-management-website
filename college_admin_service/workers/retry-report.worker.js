import { Worker } from "bullmq";
import UploadJob from "../models/UploadJob.model.js";
import { uploadToS3 } from "../utils/s3.js";
import logger from "../utils/logger.js";
import fs from "fs";
import path from "path";

const worker = new Worker("retryReportQueue", async job => {
    const { uploadJobId } = job.data;
    const uj = await UploadJob.findById(uploadJobId);
    if (!uj) throw new Error("UploadJob not found");

    logger.info(`Retrying report generation for job ${uploadJobId}`);

    // Check if report exists locally
    const reportDir = process.env.REPORT_DIR || "./reports";
    const files = fs.readdirSync(reportDir);
    const reportFile = files.find(f => f.includes(uploadJobId));

    if (!reportFile) {
        throw new Error("Report file not found locally, cannot retry upload");
    }

    const fpath = path.join(reportDir, reportFile);

    // upload report to S3 if enabled
    let reportRef = fpath;
    if (process.env.S3_BUCKET) {
        const u = await uploadToS3(fpath, "reports/");
        reportRef = u.url;
    }

    uj.reportPath = reportRef;
    await uj.save();

    logger.info(`Report retry successful for job ${uploadJobId}`);
    return { ok: true, reportPath: reportRef };
}, {
    connection: {
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: parseInt(process.env.REDIS_PORT || "6379", 10)
    }
});

worker.on("failed", (job, err) => {
    logger.error("retryReport worker failed", job?.id, err?.message);
});

logger.info("retryReport worker started");
