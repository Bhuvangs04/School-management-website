import dotenv from "dotenv";
dotenv.config();
import connectDB from "../config/db.js";
import BullMQ from "bullmq";
const { Worker } = BullMQ;
import { connection } from "../lib/redis.js";
import { notificationDLQ, auditQueue } from "../queues/notification.queue.js";
import Audit from "../models/audit.model.js";
import {
    getNewDeviceHtml, getTokenReuseHtml, getOtpHtml, getOneTimeEmail, getCollegeVerificationHtml, getCollegeDeletionHtml,
    getCollegeRecoveredHtml
} from "../utils/Email.template.js"
import axios from "axios";
import logger from "../utils/logger.js";

logger.info("Notification worker booting", {
    category: "worker",
    service: "notification"
});

let worker;


const startWorker = async () => {
    try {
        await connectDB();

        worker = new Worker(
            "notificationQueue",
            async job => {
                logger.info("Job received", {
                    category: "worker",
                    queue: "notificationQueue",
                    jobName: job.name,
                    jobId: job.id,
                    attemptsMade: job.attemptsMade
                });

                try {
                    switch (job.name) {
                        case "newDeviceEmail":
                            return await sendNewDeviceEmail(job.data);

                        case "tokenReuseAlert":
                            return await sendTokenReuseAlert(job.data);
                        
                        case "sendOtpEmail":
                            return await sendOtpEmail(job.data);

                        case "OneTimePassword":
                            return await OneTimePassword(job.data);

                        case "CollegeVerificationEmail":
                            return await sendCollegeVerificationEmail(job.data);

                        case "OneTimeRecoverToken":
                            return await sendCollegeDeletionRecoveryEmail(job.data);

                        case "CollegeRecoverSuccess":
                            return await sendCollegeRecoveredEmail(job.data);   

                        default:
                            throw new Error(`Unknown job type: ${job.name}`);
                    }
                } catch (err) {
                    logger.error(`[WORKER] Exception in job "${job.name}":`, err?.message || err);
                    throw err;
                }
            },
            { connection, concurrency: 10 }
        );

        logger.info("Notification worker started", {
            category: "worker",
            queue: "notificationQueue"
        });


        worker.on("active", job => {
            logger.info("Job active", {
                category: "worker",
                jobId: job.id,
                jobName: job.name
            });
        });

        worker.on("completed", async job => {
            logger.info("Job completed", {
                category: "worker",
                jobId: job.id,
                jobName: job.name
            });

            if (job.data?.audit) {
                try {
                    await auditQueue.add("auditEvent", job.data.audit, {
                        removeOnComplete: true
                    });
                    logger.info("Audit enqueued", {
                        category: "audit",
                        jobId: job.id
                    });
                } catch (err) {
                    logger.error("Audit enqueue failed", {
                        category: "audit",
                        error: err.message
                    });
                }
            }
        });

        worker.on("failed", async (job, err) => {
            logger.error("Job failed", {
                category: "worker",
                jobId: job?.id,
                jobName: job?.name,
                attemptsMade: job?.attemptsMade,
                error: err.message
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
                    logger.warn("Moved to DLQ", {
                        category: "dlq",
                        jobName: job.name,
                        jobId: job.id
                    });
                }
            } catch (dlqErr) {
                logger.error("DLQ push failed", {
                    category: "dlq",
                    error: dlqErr.message
                });
            }
        });

    } catch (error) {
        logger.error("Worker startup failed", {
            category: "worker",
            error: error.message,
            stack: error.stack
        });
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

        logger.info("Email sent", {
            category: "email",
            provider: "brevo",
            to,
            subject
        });
        return res.data;
    } catch (err) {
        logger.error("Email send failed", {
            category: "email",
            provider: "brevo",
            to,
            error: err.response?.data || err.message
        });
        throw err;
    }
}

async function OneTimePassword({ email, name, role, tempory_password, audit }) {
    logger.info("OneTimePassword email", {
        category: "email",
        type: "otp",
        email,
        role
    });
    if (!email) throw new Error("Missing: email");
    const html = getOneTimeEmail({ email, name, role, tempory_password, });
    await sendBrevoEmail({
        to: email,
        subject: "New Login OneTimePassword For School management system ",
        html
    });

    await saveAuditSafe(audit.userId, audit.event, audit.metadata);

    return { ok: true };

}

async function sendCollegeDeletionRecoveryEmail({
    adminEmail,
    collegeName,
    RecoverToken,
    recoverUntil,
    audit
}) {
    logger.info("Email requested", {
        category: "email",
        emailType: "college_deletion_recovery",
        to: adminEmail,
        collegeName
    });

    if (!adminEmail || !RecoverToken || !recoverUntil) {
        throw new Error("Missing adminEmail / RecoverToken / recoverUntil");
    }

    const html = getCollegeDeletionHtml({
        collegeName,
        adminEmail,
        recoverUntil,
        recoverToken: RecoverToken
    });

    await sendBrevoEmail({
        to: adminEmail,
        subject: "College Deletion Scheduled – Recovery Available",
        html
    });

    if (audit) {
        await saveAuditSafe(audit.userId, audit.event, audit.metadata);
    }

    return { ok: true };
}


async function sendCollegeRecoveredEmail({
    adminEmail,
    collegeName,
    audit
}) {
    logger.info("Email requested", {
        category: "email",
        emailType: "college_recovered",
        to: adminEmail,
        collegeName
    });

    if (!adminEmail || !collegeName) {
        throw new Error("Missing adminEmail or collegeName");
    }

    const html = getCollegeRecoveredHtml({
        collegeName
    });

    await sendBrevoEmail({
        to: adminEmail,
        subject: "College Successfully Restored",
        html
    });

    if (audit) {
        await saveAuditSafe(audit.userId, audit.event, audit.metadata);
    }

    return { ok: true };
}


async function sendCollegeVerificationEmail({
    email,
    phone,
    name,
    collegeName,
    verificationLink,
    audit
}) {
    logger.info("Email requested", {
        category: "email",
        emailType: "college_verification",
        to: email,
        collegeName
    });

    if (!email || !verificationLink)
        throw new Error("Missing: email or verificationLink");

    const html = getCollegeVerificationHtml({
        name,
        collegeName,
        phone,
        verificationLink
    });

    await sendBrevoEmail({
        to: email,
        subject: "Verify Your College Application – School Management System",
        html
    });

    if (audit?.userId) {
        await saveAuditSafe(audit.userId, audit.event, audit.metadata);
    }

    return { ok: true };
}




async function sendNewDeviceEmail({ email, deviceId, ip, geo, riskScore, approveUrl }) {
    logger.info("Email requested", {
        category: "email",
        emailType: "new_device_login",
        to: email,
        riskScore
    });

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
    logger.info("Email requested", {
        category: "email",
        emailType: "otp",
        to: email
    });
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
    logger.info("Email requested", {
        category: "email",
        emailType: "token_reuse_alert",
        to: email,
        riskScore
    });
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
        logger.info("Audit saved", {
            category: "audit",
            event,
            userId
        });
    } catch (err) {
        logger.error("Audit save failed", {
            category: "audit",
            error: err.message
        });
    }
}


async function shutdown(signal) {
    try {
        logger.info("Worker shutting down", {
            category: "process",
            signal
        });
        if (worker) {
            await worker.close();
            logger.info("[WORKER] Closed gracefully");
        }
        process.exit(0);
    } catch (err) {
        logger.error("[WORKER] Shutdown error:", err?.message || err);
        process.exit(1);
    }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", reason =>
    logger.error("Unhandled rejection", {
        category: "process",
        reason
    })
);

process.on("uncaughtException", err => {
    logger.error("Uncaught exception", {
        category: "process",
        error: err.message,
        stack: err.stack
    });
    process.exit(1);
});


startWorker();