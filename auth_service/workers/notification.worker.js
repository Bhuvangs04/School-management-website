import dotenv from "dotenv";
dotenv.config();
import connectDB from "../config/db.js";
import BullMQ from "bullmq";
const { Worker } = BullMQ;
import { connection } from "../lib/redis.js";
import { notificationDLQ, auditQueue } from "../queues/notification.queue.js";
import Audit from "../models/audit.model.js";
import { getNewDeviceHtml, getTokenReuseHtml, getOtpHtml } from "../utils/Email.template.js"
import axios from "axios";

console.log("[EMAIL] Brevo initialized");

let worker;


const startWorker = async () => {
    try {
        await connectDB();

        worker = new Worker(
            "notificationQueue",
            async job => {
                console.log(`[WORKER] job handler invoked for "${job.name}"`, {
                    id: job.id,
                    attemptsMade: job.attemptsMade,
                    opts: job.opts
                });

                try {
                    switch (job.name) {
                        case "newDeviceEmail":
                            return await sendNewDeviceEmail(job.data);

                        case "tokenReuseAlert":
                            return await sendTokenReuseAlert(job.data);
                        
                        case "sendOtpEmail":
                            return await sendOtpEmail(job.data);

                        default:
                            throw new Error(`Unknown job type: ${job.name}`);
                    }
                } catch (err) {
                    console.error(`[WORKER] Exception in job "${job.name}":`, err?.message || err);
                    throw err;
                }
            },
            { connection, concurrency: 10 }
        );

        console.log("[WORKER] Notification worker started...");


        worker.on("active", job => {
            console.log(`[WORKER] Processing job: ${job.name}`, {
                id: job.id,
                data: job.data,
                attemptsMade: job.attemptsMade
            });
        });

        worker.on("completed", async job => {
            console.log(`[WORKER] Job completed: ${job.name}`, { id: job.id });

            if (job.data?.audit) {
                try {
                    await auditQueue.add("auditEvent", job.data.audit, {
                        removeOnComplete: true
                    });
                    console.log("[WORKER] Audit queued");
                } catch (err) {
                    console.error("[WORKER] Failed to enqueue audit:", err?.message || err);
                }
            }
        });

        worker.on("failed", async (job, err) => {
            console.error(`[WORKER] Job failed: ${job?.name}`, {
                id: job?.id,
                attemptsMade: job?.attemptsMade,
                reason: err?.message || String(err)
            });

            try {
                if (job.attemptsMade >= job.opts?.attempts) {
                    await notificationDLQ.add(
                        "dead",
                        {
                            originalName: job.name,
                            data: job.data,
                            failedReason: err?.message || String(err),
                            attemptsMade: job.attemptsMade,
                            finishedAt: new Date()
                        },
                        { removeOnComplete: true }
                    );
                    console.warn("[DLQ] Moved to DLQ:", job.name);
                }
            } catch (dlqErr) {
                console.error("[DLQ] Failed to push to DLQ:", dlqErr?.message || dlqErr);
            }
        });

    } catch (error) {
        console.error("Failed to start worker:", error);
        process.exit(1);
    }
};


async function sendBrevoEmail({ to, subject, html }) {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const senderName = process.env.BREVO_SENDER_NAME || "School App";

    if (!apiKey) throw new Error("BREVO_API_KEY missing");

    try {
        const res = await axios.post(
            "https://api.brevo.com/v3/smtp/email",
            {
                sender: { name: senderName, email: senderEmail },
                to: [{ email: to }],
                subject,
                htmlContent: html 
            },
            {
                headers: {
                    "api-key": apiKey,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("[BREVO] Email sent", res.data);
        return res.data;
    } catch (err) {
        console.error("[BREVO] Email error:", err?.response?.data || err.message);
        throw err;
    }
}


async function sendNewDeviceEmail({ email, deviceId, ip, geo, riskScore, approveUrl }) {
    console.log("[EMAIL] sendNewDeviceEmail called", { email, deviceId, ip, geo, riskScore, approveUrl });

    if (!email) throw new Error("Missing: email");

    const html = getNewDeviceHtml({ deviceId, ip, geo, riskScore, approveUrl });

    await sendBrevoEmail({
        to: email,
        subject: "New Device Login Detected",
        html
    });

    await saveAuditSafe(email, "NEW_DEVICE_EMAIL_SENT", { deviceId, ip, geo, riskScore, approveUrl });

    return { ok: true };
}

async function sendOtpEmail({ email, otp }) {
    console.log("[EMAIL] sendOtpEmail called", { email, otp });

    if (!email || !otp) throw new Error("Missing email or otp");

    const html = getOtpHtml(otp)

    await sendBrevoEmail({
        to: email,
        subject: "OTP from School Management System",
        html
    });

    await saveAuditSafe(email, "OTP_SENT", { otp });

    return { ok: true };
}


async function sendTokenReuseAlert({ email, deviceId, ip, geo, riskScore, revokeUrl, revokeAllUrl }) {
    console.log("[EMAIL] sendTokenReuseAlert called", {email, deviceId, ip, geo, riskScore, revokeUrl,revokeAllUrl });

    if (!email) throw new Error("Missing: email");

    const html = getTokenReuseHtml({ deviceId, ip, geo, riskScore, revokeUrl, revokeAllUrl });

    await sendBrevoEmail({
        to: email,
        subject: "Security Alert: Token Reuse Detected",
        html
    });

    await saveAuditSafe(email, "TOKEN_REUSE_ALERT_SENT", { deviceId, ip, geo, riskScore, revokeUrl, revokeAllUrl });

    return { ok: true };
}


async function saveAuditSafe(userId, event, metadata = {}) {
    try {
        await Audit.create({ userId, event, metadata, createdAt: new Date() });
        console.log("[AUDIT] Saved:", { userId, event });
    } catch (err) {
        console.error("[AUDIT] save failed:", err?.message || err);
    }
}


async function shutdown(signal) {
    try {
        console.log(`[WORKER] Shutting down (${signal})`);
        if (worker) {
            await worker.close();
            console.log("[WORKER] Closed gracefully");
        }
        process.exit(0);
    } catch (err) {
        console.error("[WORKER] Shutdown error:", err?.message || err);
        process.exit(1);
    }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", reason =>
    console.error("[PROCESS] Unhandled Rejection:", reason)
);

process.on("uncaughtException", err => {
    console.error("[PROCESS] Uncaught Exception:", err?.message || err);
    process.exit(1);
});


startWorker();