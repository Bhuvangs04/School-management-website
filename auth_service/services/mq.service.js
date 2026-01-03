import rabbitMQ from "../utils/rabbitmq.js";
import User from "../models/user.model.js";
import { notificationQueue } from "../queues/notification.queue.js";
import logger from "../utils/logger.js";
import { makeTempPassword, hashPassword } from "../utils/password.js";

class MQService {
    constructor() {
        this.exchanges = {
            COLLEGE_EVENTS: "college.events",
            USER_EVENTS: "user.events"
        };

        this.queues = {
            AUTH_COLLEGE_EVENTS: "auth.college.events",
            AUTH_USER_EVENTS: "auth.user.events",
            USER_REGISTERED: "user_registered",
            ADMIN_ACTION: "admin_action",
            COLLEGE_EMAIL_VERIFICATION: "college_email_verification",
        };
    }

    async init() {
        await rabbitMQ.connect();

        // FANOUT
        this.consumeCollegeEvents();
        this.consumeUserEvents();

        // QUEUE BASED (single consumer is fine)
        this.consumeUserRegistered();
        this.consumeAdminAction();
        this.consumeCollegeEmailVerification();

        logger.info("MQ service initialized", {
            category: "mq",
            service: "auth-service"
        });
    }

    /* ================= FANOUT CONSUMER ================= */

    async consumeUserEvents() {
        await rabbitMQ.consumeFanout(
            this.exchanges.USER_EVENTS,
            this.queues.AUTH_USER_EVENTS,
            async (event) => {
                try {
                    switch (event.type) {

                        case "USER_ONBOARD_REQUESTED":
                            await this.handleUserOnboardRequested(event.payload);
                            break;

                        default:
                            logger.warn("Unknown USER event", {
                                category: "mq",
                                eventType: event.type
                            });
                    }
                } catch (err) {
                    logger.error("USER_EVENTS handler failed", {
                        category: "mq",
                        eventType: event.type,
                        message: err.message,
                        stack: err.stack
                    });
                }
            }
        );

        logger.info("Listening to USER_EVENTS", {
            category: "mq",
            exchange: this.exchanges.USER_EVENTS
        });
    }


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
                        logger.warn("Unknown COLLEGE event", {
                            category: "mq",
                            eventType: event.type
                        });
                }
            }
        );

        logger.info("Listening to COLLEGE_EVENTS", {
            category: "mq",
            exchange: this.exchanges.COLLEGE_EVENTS
        });
    }

    async handleUserOnboardRequested(payload) {
        const {
            eventId,
            email,
            name,
            role,
            collegeId,
            departmentId,
            addedBy
        } = payload;

        let user = await User.findOne({ email });
        let rawPassword = null;

        // Idempotent user creation
        if (!user) {
            rawPassword = makeTempPassword();
            const hashed = await hashPassword(rawPassword);

            user = await User.create({
                name,
                email,
                passwordHash: hashed,
                role,
                collegeId,
                passwordChanged: false
            });

            // Send temp password ONLY for new users
            await notificationQueue.add("OneTimePassword", {
                email,
                name,
                role,
                tempory_password: rawPassword,
                audit: {
                    userId: user._id,
                    event: "USER_ONBOARDED_TEMP_PASSWORD_SENT",
                    metadata: { collegeId, departmentId }
                }
            });
        }

        // 🔁 CONFIRM BACK TO COLLEGE SERVICE
        await rabbitMQ.publishFanout(
            this.exchanges.USER_EVENTS,
            {
                type: "USER_ONBOARDED",
                payload: {
                    eventId,
                    userId: user._id,
                    name,
                    email,
                    role,
                    collegeId,
                    departmentId,
                    addedBy
                }
            }
        );

        logger.info("User onboarded", {
            category: "mq",
            action: "USER_ONBOARDED",
            email,
            userId: user._id
        });
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

        logger.warn("College deleted – users disabled", {
            category: "college",
            collegeId
        });
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

        logger.info("College recovered – users re-enabled", {
            category: "college",
            collegeId
        });
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

        logger.info("College admin created", {
            category: "college",
            collegeId,
            adminEmail
        });
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
                logger.error("USER_REGISTERED processing failed", {
                    category: "mq",
                    message: err.message,
                    stack: err.stack
                });
            }
        });
    }

    async consumeAdminAction() {
        await rabbitMQ.consume(this.queues.ADMIN_ACTION, async (data) => {
            logger.info("Admin action received", {
                category: "admin",
                action: data.action
            });
        });
    }

    async consumeCollegeEmailVerification() {
        await rabbitMQ.consume(this.queues.COLLEGE_EMAIL_VERIFICATION, async (data) => {
            await notificationQueue.add("CollegeVerificationEmail", data);
            logger.info("College verification email queued", {
                category: "email",
                email: data.email
            });
        });
    }
}

export default new MQService();
