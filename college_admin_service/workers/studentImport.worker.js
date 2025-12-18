/* streaming excel worker with action links, s3 upload of reports, pm2 metrics counters */
import dotenv from "dotenv";
dotenv.config();

import { Worker } from "bullmq";
import UploadJob from "../models/UploadJob.model.js";
import connectDB from "../config/db.js";
await connectDB();
import { connection } from "../lib/redis.js";
import Student from "../models/Student.model.js";
import User from "../models/User.model.js";
import Excel from "exceljs";
import path from "path";
import fs from "fs";
import { createAudit } from "../utils/audit.js";
import logger from "../utils/logger.js";
import { uploadToS3, downloadFromS3 } from "../utils/s3.js";
import MQService from "../services/mq.service.js";


// pm2 metrics
import io from "@pm2/io";
const metrics = {
    rowsProcessed: io.counter({ name: "rows_processed" }),
    studentsCreated: io.counter({ name: "students_created" }),
    parentsCreated: io.counter({ name: "parents_created" }),
    emailsQueued: io.counter({ name: "emails_queued" }),
    uploadSuccesses: io.counter({ name: "upload_successes" }),
    uploadFailures: io.counter({ name: "upload_failures" })
};

/**
 * Robustly extracts text from an ExcelJS cell object.
 * Handles: Primitives, RichText, Hyperlinks, Formulas.
 */
function getCellText(cell) {
    if (cell === null || cell === undefined) return "";

    if (typeof cell !== "object") return String(cell).trim();

    if (cell.richText && Array.isArray(cell.richText)) {
        return cell.richText.map(part => part.text).join("").trim();
    }

    if (cell.text !== undefined) return String(cell.text).trim();

    if (cell.result !== undefined) return String(cell.result).trim();

    if (cell instanceof Date) return cell.toISOString();

    return "";
}

function safeVal(v) {
    return (v === undefined || v === null) ? "" : String(v).trim();
}

const worker = new Worker(
    "studentImportQueue",
    async job => {
        const { uploadJobId, path: filePath } = job.data;

        let localFile = filePath;

        if (filePath.startsWith("s3://") || filePath.includes(".amazonaws.com")) {
            logger.info("Downloading file from S3:", filePath);

            localFile = await downloadFromS3(filePath, "./temp");

            logger.info("Downloaded to local:", localFile);
        }

        const uj = await UploadJob.findById(uploadJobId);
        if (!uj) throw new Error("UploadJob not found");

        uj.status = "processing";
        await uj.save();

        const successes = [];
        const failures = [];

        // 1. Determine Reader based on extension (CSV vs XLSX)
        const ext = path.extname(localFile).toLowerCase();
        let reader;

        const options = {
            worksheets: "emit",
            sharedStrings: "cache",
            styles: "cache"
        };

        if (ext === ".csv") {
            reader = new Excel.stream.csv.WorkbookReader(localFile, options);
        } else {
            reader = new Excel.stream.xlsx.WorkbookReader(localFile, options);
        }

        let headerMap = null;
        let processed = 0;

        try {
            for await (const sheet of reader) {
                for await (const row of sheet) {

                    // Skip if row is empty or invalid
                    if (!row.values || !Array.isArray(row.values) || row.values.length === 0) continue;

                    // 2. Handle Headers
                    if (!headerMap) {
                        // Map headers using getCellText to ensure strings
                        headerMap = row.values.map(v => {
                            const txt = getCellText(v);
                            return txt ? txt.toLowerCase() : null;
                        });

                        // Basic validation: Check if this row actually looks like a header
                        // If it doesn't have 'name' or 'email' or 'roll', it might be a title row
                        const hasKeywords = headerMap.some(h => h && (h.includes('name') || h.includes('email') || h.includes('roll')));
                        if (!hasKeywords) {
                            headerMap = null; // Reset and try next row
                        }
                        continue;
                    }

                    // 3. Construct Row Object
                    const rowObj = {};
                    let hasData = false;

                    row.values.forEach((val, i) => {
                        const key = headerMap[i];
                        if (key) {
                            const cleanVal = getCellText(val);
                            rowObj[key] = cleanVal;
                            if (cleanVal) hasData = true;
                        }
                    });

                    // Skip completely empty rows
                    if (!hasData) continue;

                    processed++;
                    metrics.rowsProcessed.inc();
                    uj.processed = processed;

                    const name = safeVal(rowObj.name || rowObj.studentname);
                    const studentEmail = safeVal(rowObj.email || rowObj.studentemail).toLowerCase();
                    const rollNumber = safeVal(rowObj.rollnumber || rowObj.roll);
                    const parentName = safeVal(rowObj.parentname);
                    const parentEmail = safeVal(rowObj.parentemail).toLowerCase();
                    const studentClass = safeVal(rowObj.class);
                    const section = safeVal(rowObj.section);

                    try {
                        // Validation
                        if (!name || !rollNumber) {
                            failures.push({
                                row: processed,
                                reason: "name or rollNumber missing",
                                rowObj
                            });
                            uj.failed++;
                            metrics.uploadFailures.inc();
                            // Only save every 10 rows to reduce DB load, or save at end
                            if (processed % 10 === 0) await uj.save();
                            continue;
                        }

                        const exists = await Student.findOne({
                            collegeId: uj.collegeId,
                            rollNumber
                        });

                        if (exists) {
                            failures.push({ row: processed, reason: "student exists", rowObj });
                            uj.failed++;
                            metrics.uploadFailures.inc();
                            continue;
                        }

                        // CREATE STUDENT
                        const studentDoc = await Student.create({
                            collegeId: uj.collegeId,
                            rollNumber,
                            name,
                            dob: rowObj.dob || null,
                            class: studentClass,
                            section
                        });

                        uj.succeeded++;
                        metrics.studentsCreated.inc();

                        let newUser = null;

                        // STUDENT USER
                        if (studentEmail) {
                            let exUser = await User.findOne({ email: studentEmail });

                            if (!exUser) {
                                newUser = await User.create({
                                    name,
                                    email: studentEmail,
                                    role: "student",
                                    collegeId: uj.collegeId,
                                    studentId: studentDoc._id
                                });

                                metrics.emailsQueued.inc();
                            } else {
                                if (!exUser.studentId) {
                                    exUser.studentId = studentDoc._id;
                                    await exUser.save();
                                }
                            }

                            if (newUser) {
                                try {
                                    await MQService.publishUserRegistered({
                                        name,
                                        email: studentEmail,
                                        role: "student",
                                        collegeId: uj.collegeId,
                                        studentId: studentDoc._id
                                    });
                                } catch (err) {
                                    logger.error("MQ publish student failed", err);
                                }
                            }
                        }

                        // PARENT USER
                        if (parentEmail) {
                            let parentUser = await User.findOne({ email: parentEmail });

                            if (!parentUser) {
                                parentUser = await User.create({
                                    name: parentName || `${name} Parent`,
                                    email: parentEmail,
                                    role: "parent",
                                    collegeId: uj.collegeId,
                                    parentOf: [studentDoc._id]
                                });

                                metrics.parentsCreated.inc();
                                metrics.emailsQueued.inc();
                            } else {
                                // Mongoose ID check needs string comparison or .equals
                                const isParent = parentUser.parentOf.some(id => id.toString() === studentDoc._id.toString());
                                if (!isParent) {
                                    parentUser.parentOf.push(studentDoc._id);
                                    await parentUser.save();
                                }
                            }

                            // Link parent -> student
                            if (!studentDoc.parents) studentDoc.parents = [];
                            const isLinked = studentDoc.parents.some(id => id.toString() === parentUser._id.toString());
                            if (!isLinked) {
                                studentDoc.parents.push(parentUser._id);
                                await studentDoc.save();
                            }

                            try {
                                await MQService.publishUserRegistered({
                                    name: parentName || `${name} Parent`,
                                    email: parentEmail,
                                    role: "parent",
                                    collegeId: uj.collegeId,
                                    parentOf: [studentDoc._id]
                                });
                            } catch (err) {
                                logger.error("MQ publish parent failed", err);
                            }
                        }

                        successes.push({ row: processed, studentId: studentDoc._id });
                        metrics.uploadSuccesses.inc();

                    } catch (err) {
                        logger.error("[WORKER] Row failed", {
                            row: processed,
                            message: err.message,
                            rowObj
                        });

                        failures.push({
                            row: processed,
                            reason: err.message,
                            rowObj
                        });

                        metrics.uploadFailures.inc();
                        uj.failed++;
                    }
                }
            }
        } catch (streamError) {
            logger.error("Streaming error", streamError);
            uj.status = "failed";
            // You might want to save here if the whole stream crashed
        }

        // Final Save before report
        await uj.save();

        const reportDir = process.env.REPORT_DIR || "./reports";
        if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

        const fname = `report-${uploadJobId}-${Date.now()}.json`;
        const fpath = path.join(reportDir, fname);
        fs.writeFileSync(fpath, JSON.stringify({ successes, failures }, null, 2));

        let reportRef = fpath;

        if (process.env.S3_BUCKET) {
            try {
                const { url } = await uploadToS3(fpath, `reports/${uploadJobId}/`);
                reportRef = url;

                // optionally delete local file
                fs.unlinkSync(fpath);
            } catch (err) {
                logger.error("Report upload to S3 failed:", err);
            }
        }


        uj.reportPath = reportRef;
        uj.status = "completed";
        uj.completedAt = new Date();
        await uj.save();

        await createAudit(null, "UPLOAD_JOB_COMPLETED", {
            uploadJobId,
            successes: successes.length,
            failures: failures.length
        });

        return { ok: true, processed: uj.processed };
    },
    {
        connection,
        concurrency: parseInt(process.env.WORKER_CONCURRENCY || "3", 10)
    }
);

logger.info("studentImport worker (streaming) started");