import dotenv from "dotenv";
dotenv.config();

import { Queue } from "bullmq";
import IORedis from "ioredis";
import path from "path";
import fs from "fs";

const connection = new IORedis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT || "6379", 10)
});

const studentImportQueue = new Queue("studentImportQueue", { connection });

async function publish() {
    // path to the sample excel you already generated
    const filePath = path.resolve(process.cwd(), "../College_students.xlsx");
    if (!fs.existsSync(filePath)) {
        console.error("Test file not found:", filePath);
        process.exit(1);
    }

    // create a minimal UploadJob doc if you don't have a DB helper – adjust as needed
    // For quick test, you can create a dummy uploadJobId in DB; here we'll assume one already exists.
    // If you don't have UploadJob in DB, create one using mongoose or adapt this script to create it.
    const uploadJobId = process.env.TEST_UPLOAD_JOB_ID || null;
    if (!uploadJobId) {
        console.error("Set TEST_UPLOAD_JOB_ID env to a valid UploadJob Mongo _id, or create one.");
        // still enqueue to test error handling without DB lookup
    }

    const job = await studentImportQueue.add("importXlsx", {
        uploadJobId,
        path: filePath
    }, { attempts: 1 });

    console.log("Published test job:", job.id);
    process.exit(0);
}

publish().catch(err => {
    console.error("Publish failed", err);
    process.exit(1);
});
