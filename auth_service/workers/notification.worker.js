import dotenv from "dotenv";
dotenv.config();

import BullMQ from "bullmq";
const { Worker } = BullMQ;

import { connection } from "../lib/redis.js";
import { notificationDLQ, auditQueue } from "../queues/notification.queue.js";
import Audit from "../models/audit.model.js";

// RESEND
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

console.log("[EMAIL] Resend initialized");

// ---------------- WORKER ----------------- //

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
            console.error(`[WORKER] Exception in job "${job.name}":`, err?.message || err);
            throw err;
        }
    },
    { connection, concurrency: 10 }
);

console.log("[WORKER] Notification worker started...");

// ---------------- EVENTS ----------------- //

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
            console.log("[WORKER] Audit queued for completed job");
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
            console.warn("[DLQ] Job moved to DLQ:", job.name);
        }
    } catch (dlqErr) {
        console.error("[DLQ] Failed to push to DLQ:", dlqErr?.message || dlqErr);
    }
});

// ------------- EMAIL FUNCTIONS (RESEND) ------------- //

async function sendNewDeviceEmail({ email, deviceId, ip, geo, riskScore }) {
    console.log("[EMAIL] sendNewDeviceEmail called", { email, deviceId, ip, geo, riskScore });

    if (!email) throw new Error("Missing required field: email");

    const text = `We detected a login from a new device.

Device ID: ${deviceId || "unknown"}
IP Address: ${ip || "unknown"}
Location: ${geo?.country || "unknown"}, ${geo?.city || ""}
Risk Score: ${riskScore ?? "unknown"}

If this was not you, please secure your account immediately.
`;

    try {
        const res = await resend.emails.send({
            from: "School App <onboarding@resend.dev>",
            to: email,
            subject: "New Device Login Detected",
            text
        });

        console.log("[EMAIL] newDeviceEmail sent successfully", { email, id: res?.id });
    } catch (err) {
        console.error("[EMAIL] newDeviceEmail failed:", err?.message || err);
        throw err;
    }

    await saveAuditSafe(email, "NEW_DEVICE_EMAIL_SENT", { deviceId, ip, geo, riskScore });
    return { ok: true };
}

async function sendTokenReuseAlert({ email, deviceId, ip, geo, riskScore }) {
    console.log("[EMAIL] sendTokenReuseAlert called", { email, deviceId, ip, geo, riskScore });

    if (!email) throw new Error("Missing required field: email");

    const text = `We detected a refresh token reuse attempt.

Device ID: ${deviceId || "unknown"}
IP: ${ip || "unknown"}
Location: ${geo?.country || "unknown"}, ${geo?.city || ""}
Risk Score: ${riskScore ?? "unknown"}

All sessions have been revoked for your safety.
`;

    try {
        const res = await resend.emails.send({
            from: "School App <onboarding@resend.dev>",
            to: email,
            subject: "Security Alert: Token Reuse Detected",
            text
        });

        console.log("[EMAIL] tokenReuseAlert sent successfully", { email, id: res?.id });
    } catch (err) {
        console.error("[EMAIL] tokenReuseAlert failed:", err?.message || err);
        throw err;
    }

    await saveAuditSafe(email, "TOKEN_REUSE_ALERT_SENT", { deviceId, ip, geo, riskScore });
    return { ok: true };
}

// ------------------- AUDIT HELPER ------------------- //

async function saveAuditSafe(userId, event, metadata = {}) {
    try {
        await Audit.create({ userId, event, metadata, createdAt: new Date() });
        console.log("[AUDIT] Saved:", { userId, event });
    } catch (err) {
        console.error("[AUDIT] save failed:", err?.message || err);
    }
}

// ---------------- SHUTDOWN ---------------- //

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

process.on("unhandledRejection", reason => console.error("[PROCESS] Unhandled Rejection:", reason));
process.on("uncaughtException", err => {
    console.error("[PROCESS] Uncaught Exception:", err?.message || err);
    process.exit(1);
});
