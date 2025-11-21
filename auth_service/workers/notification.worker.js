import dotenv from "dotenv";
dotenv.config();
import BullMQ from "bullmq";
const { Worker} = BullMQ; 
import { connection } from "../lib/redis.js";
import nodemailer from "nodemailer";
import { notificationDLQ, auditQueue } from "../queues/notification.queue.js";
import Audit from "../models/audit.model.js";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    }
});

// Verify transporter early so we fail fast if creds are wrong
transporter.verify()
    .then(() => console.log("[EMAIL] Transporter verified (ready to send)"))
    .catch(err => console.error("[EMAIL] Transporter verification failed:", err?.message || err));

const worker = new Worker(
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

                default:
                    throw new Error(`Unknown job type: ${job.name}`);
            }
        } catch (err) {
            // Re-throw so bullmq registers the failure (and can retry / call failed handlers)
            console.error(`[WORKER] Exception in job "${job.name}":`, err?.message || err, {
                stack: err?.stack
            });
            throw err;
        }
    },
    { connection, concurrency: 10 },
    
);




// Log lifecycle events
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

    // When job completes → log audit if included
    if (job.data?.audit) {
        try {
            await auditQueue.add("auditEvent", job.data.audit, {
                removeOnComplete: true
            });
            console.log("[WORKER] Audit queued for completed job:", { jobId: job.id });
        } catch (err) {
            console.error("[WORKER] Failed to enqueue audit for completed job:", err?.message || err);
        }
    }
});

worker.on("failed", async (job, err) => {
    console.error(`[WORKER] Job failed: ${job?.name}`, {
        id: job?.id,
        attemptsMade: job?.attemptsMade,
        reason: err?.message || String(err)
    });

    // If job exhausted attempts -> push to DLQ for later inspection
    try {
        const attemptsMade = job?.attemptsMade || 0;
        const maxAttempts = job?.opts?.attempts || 0;

        if (maxAttempts > 0 && attemptsMade >= maxAttempts) {
            await notificationDLQ.add(
                "dead",
                {
                    originalName: job.name,
                    data: job.data,
                    failedReason: err?.message || String(err),
                    attemptsMade,
                    finishedAt: new Date()
                },
                { removeOnComplete: true }
            );
            console.warn("[DLQ] Job moved to DLQ:", { jobName: job.name, jobId: job.id });
        }
    } catch (dlqErr) {
        console.error("[DLQ] Failed to push job to DLQ:", dlqErr?.message || dlqErr);
    }
});

// ------------ EMAIL SENDER FUNCTIONS ------------ //

async function sendNewDeviceEmail({ email, deviceId, ip, geo, riskScore } = {}) {
    console.log("[EMAIL] sendNewDeviceEmail called", { email, deviceId, ip, geo, riskScore });

    if (!email) {
        const err = new Error("Missing required field: email");
        console.error("[EMAIL] Validation error:", err.message);
        throw err;
    }

    const mailOptions = {
        to: email,
        subject: "New device login detected",
        text: `We detected a login from a new device.

Device ID: ${deviceId || "unknown"}
IP Address: ${ip || "unknown"}
Location: ${geo?.country || "unknown"}, ${geo?.city || ""}
Risk Score: ${riskScore ?? "unknown"}

If this was not you, please secure your account immediately.
`
    };

    try {
        const res = await transporter.sendMail(mailOptions);
        console.log("[EMAIL] newDeviceEmail sent successfully", { email, messageId: res?.messageId });
    } catch (err) {
        console.error("[EMAIL] newDeviceEmail failed to send:", err?.message || err);
        // Let the worker fail so bullmq can retry according to job opts
        throw err;
    }

    await saveAuditSafe(email, "NEW_DEVICE_EMAIL_SENT", { deviceId, ip, geo, riskScore });
    return { ok: true };
}

async function sendTokenReuseAlert({ email, deviceId, ip, geo, riskScore } = {}) {
    console.log("[EMAIL] sendTokenReuseAlert called", { email, deviceId, ip, geo, riskScore });

    if (!email) {
        const err = new Error("Missing required field: email");
        console.error("[EMAIL] Validation error:", err.message);
        throw err;
    }

    const mailOptions = {
        to: email,
        subject: "Security Alert: Token Reuse Detected",
        text: `We detected an attempt to reuse a refresh token.

Device ID: ${deviceId || "unknown"}
IP Address: ${ip || "unknown"}
Location: ${geo?.country || "unknown"}, ${geo?.city || ""}
Risk Score: ${riskScore ?? "unknown"}

We have revoked all active sessions for your security.
`
    };

    try {
        const res = await transporter.sendMail(mailOptions);
        console.log("[EMAIL] tokenReuseAlert sent successfully", { email, messageId: res?.messageId });
    } catch (err) {
        console.error("[EMAIL] tokenReuseAlert failed to send:", err?.message || err);
        throw err;
    }

    await saveAuditSafe(email, "TOKEN_REUSE_ALERT_SENT", { deviceId, ip, geo, riskScore });
    return { ok: true };
}

// ------------ AUDIT HELPER (safe) ------------ //

async function saveAuditSafe(userId, event, metadata = {}) {
    try {
        await Audit.create({ userId, event, metadata, createdAt: new Date() });
        console.log("[AUDIT] Saved:", { userId, event });
    } catch (err) {
        // Don't fail the whole worker if audit save fails; just log it.
        console.error("[AUDIT] save failed:", err?.message || err, { userId, event });
    }
}

// Graceful shutdown handlers
async function shutdown(signal) {
    try {
        console.log(`[WORKER] Shutdown signal received (${signal}). Closing worker...`);
        await worker.close();
        console.log("[WORKER] Worker closed gracefully.");
        process.exit(0);
    } catch (err) {
        console.error("[WORKER] Error during shutdown:", err?.message || err);
        process.exit(1);
    }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Extra safety: capture unhandled rejections / exceptions so the process doesn't silently die
process.on("unhandledRejection", (reason) => {
    console.error("[PROCESS] Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
    console.error("[PROCESS] Uncaught Exception:", err?.message || err, { stack: err?.stack });
    // allow process to exit after logging — orchestrator should restart
    process.exit(1);
});
