import rabbitMQ from "../utils/rabbitmq.js";
import User from "../models/user.model.js";
import { notificationQueue } from "../queues/notification.queue.js";
import logger from "../utils/logger.js";
import { makeTempPassword, hashPassword } from "../utils/password.js";

class MQService {
    constructor() {
        this.exchanges = {
            COLLEGE_EVENTS: "college.events",
        };

        this.queues = {
            AUTH_COLLEGE_EVENTS: "auth.college.events", // 🔑 UNIQUE to auth-service
            USER_REGISTERED: "user_registered",
            ADMIN_ACTION: "admin_action",
            COLLEGE_EMAIL_VERIFICATION: "college_email_verification",
            COLLEGE_CREATED: "college_created",
        };
    }

    async init() {
        await rabbitMQ.connect();

        // FANOUT
        this.consumeCollegeEvents();

        // QUEUE BASED (single consumer is fine)
        this.consumeUserRegistered();
        this.consumeAdminAction();
        this.consumeCollegeEmailVerification();
    }

    /* ================= FANOUT CONSUMER ================= */

    async consumeCollegeEvents() {
        await rabbitMQ.consumeFanout(
            this.exchanges.COLLEGE_EVENTS,
            this.queues.AUTH_COLLEGE_EVENTS,
            async (event) => {
                switch (event.type) {
                    case "COLLEGE_DELETION":
                        await this.handleCollegeDeletion(event.payload);
                        break;

                    case "COLLEGE_RECOVER":
                        await this.handleCollegeRecover(event.payload);
                        break;

                    case "COLLEGE_CREATED":
                        await this.handleCollegeCreated(event.payload);
                        break;

                    default:
                        logger.warn(`[AUTH] Unknown college event: ${event.type}`);
                }
            }
        );

        logger.info("[AUTH] Listening to college.events (fanout)");
    }

    async handleCollegeDeletion(data) {
        const { collegeId, recoverUntil, RecoverToken, collegeName, adminEmail } = data;

        logger.info(`[AUTH] COLLEGE_DELETION → disabling users for ${collegeId}`);

        await User.updateMany(
            { collegeId, status: { $ne: "DISABLED" } },
            {
                $set: {
                    status: "DISABLED",
                    disabledReason: "COLLEGE_DELETION",
                    disabledUntil: recoverUntil
                }
            }
        );

        await notificationQueue.add(
            "OneTimeRecoverToken",
            {
                adminEmail,
                collegeName,
                RecoverToken,
                recoverUntil,
                audit: {
                    userId: collegeId,
                    event: "COLLEGE_DELETION_EMAIL_SENT",
                    metadata: { collegeId }
                }
            },
            { attempts: 5 }
        );

        logger.info(`[AUTH] Users disabled + email queued for ${collegeId}`);
    }

    async handleCollegeRecover(data) {
        const { collegeId, collegeName, adminEmail } = data;

        logger.info(`[AUTH] COLLEGE_RECOVER → enabling users for ${collegeId}`);

        await User.updateMany(
            { collegeId, status: "DISABLED" },
            {
                $set: { status: "ACTIVE" },
                $unset: { disabledReason: "", disabledUntil: "" }
            }
        );

        await notificationQueue.add(
            "CollegeRecoverSuccess",
            {
                adminEmail,
                collegeName,
                audit: {
                    userId: collegeId,
                    event: "COLLEGE_RECOVER_EMAIL_SENT",
                    metadata: { collegeId }
                }
            },
            { attempts: 5 }
        );

        logger.info(`[AUTH] Users re-enabled for ${collegeId}`);
    }

    async handleCollegeCreated(data) {
        const { collegeId, name, code, adminEmail, adminPhone } = data;

        let admin = await User.findOne({
            email: adminEmail,
            role: "college_admin"
        });

        if (admin) return;

        const rawPassword = makeTempPassword();
        const hashed = await hashPassword(rawPassword);

        admin = await User.create({
            name: `${name} Admin`,
            email: adminEmail,
            phone: adminPhone,
            passwordHash: hashed,
            role: "college_admin",
            collegeId,
            code,
            passwordChanged: false
        });

        await notificationQueue.add("OneTimePassword", {
            email: adminEmail,
            name,
            role: "college_admin",
            tempory_password: rawPassword,
            audit: {
                userId: admin._id,
                event: "FIRST_COLLEGE_ADMIN_CREATED",
                metadata: { collegeId, code }
            }
        });

        logger.info(`[AUTH] College admin created → ${adminEmail}`);
    }


    /* ================= QUEUE CONSUMERS ================= */

    async consumeUserRegistered() {
        await rabbitMQ.consume(this.queues.USER_REGISTERED, async (data) => {
            try {
                const { name, email, role, collegeId, studentId, parentOf } = data;

                let user = await User.findOne({ email });
                let rawPassword = null;

                if (!user) {
                    rawPassword = makeTempPassword();
                    const hashed = await hashPassword(rawPassword);

                    user = await User.create({
                        name,
                        email,
                        passwordHash: hashed,
                        role,
                        collegeId,
                        studentId,
                        parentOf,
                        passwordChanged: false
                    });
                }

                await notificationQueue.add("OneTimePassword", {
                    email,
                    name,
                    role,
                    tempory_password: rawPassword,
                    audit: {
                        userId: user._id,
                        event: "USER_REGISTERED_OTP_TRIGGERED",
                        metadata: { role }
                    }
                });

            } catch (err) {
                logger.error(`[AUTH] USER_REGISTERED error: ${err.message}`);
            }
        });
    }

    async consumeAdminAction() {
        await rabbitMQ.consume(this.queues.ADMIN_ACTION, async (data) => {
            logger.info(`[AUTH] ADMIN_ACTION → ${data.action}`);
        });
    }

    async consumeCollegeEmailVerification() {
        await rabbitMQ.consume(this.queues.COLLEGE_EMAIL_VERIFICATION, async (data) => {
            await notificationQueue.add("CollegeVerificationEmail", data);
            logger.info(`[AUTH] Verification email queued → ${data.email}`);
        });
    }
}

export default new MQService();
