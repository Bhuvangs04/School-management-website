import rabbitMQ from '../utils/rabbitmq.js';
import User from '../models/user.model.js';
import { notificationQueue } from "../queues/notification.queue.js"; 
import logger from "../utils/logger.js";
import { makeTempPassword, hashPassword } from "../utils/password.js"

class MQService {
    constructor() {
        this.queues = {
            COLLEGE_CREATED: 'college_created',
            USER_REGISTERED: 'user_registered',
            ADMIN_ACTION: 'admin_action',
            COLLEGE_EMAIL_VERIFICATION: 'college_email_verification'
        };
    }

    async init() {
        await rabbitMQ.connect();

        this.consumeCollegeCreated();
        this.consumeUserRegistered();
        this.consumeAdminAction();
        this.consumeCollegeEmailVerification();
    }

    async consumeCollegeCreated() {
        await rabbitMQ.consume(this.queues.COLLEGE_CREATED, async (data) => {
            logger.info(`[RMQ] COLLEGE_CREATED received → ${data.name}`);

            try {
                const {
                    collegeId,
                    name,
                    code,
                    adminEmail,
                    adminPhone
                } = data;

                let admin = await User.findOne({
                    email: adminEmail,
                    role: "college_admin"
                });

                if (admin) {
                    logger.info(`[AUTH] College admin already exists → ${adminEmail}`);
                    return;
                }

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

                logger.info(`[AUTH] FIRST COLLEGE ADMIN created → ${adminEmail}`);

                await notificationQueue.add(
                    "OneTimePassword",
                    {
                        email: adminEmail,
                        name,
                        role: "college_admin",
                        tempory_password: rawPassword,
                        audit: {
                            userId: admin._id,
                            event: "FIRST_COLLEGE_ADMIN_CREATED",
                            metadata: { collegeId, code }
                        }
                    }
                );

                logger.info(`[AUTH] OTP email queued → ${adminEmail}`);

            } catch (err) {
                logger.error(`[AUTH] Error in COLLEGE_CREATED: ${err.message}`);
            }
        });
    }


    /**
     * Main listener for student/parent creation events coming from college-service
     */
    async consumeUserRegistered() {
        await rabbitMQ.consume(this.queues.USER_REGISTERED, async (data) => {
            logger.info(`[RABBITMQ] USER_REGISTERED event received for ${data.email}`);

            try {
                const {
                    name,
                    email,
                    role,
                    collegeId,
                    studentId,
                    parentOf
                } = data;

                // 1. Sync user in auth DB (idempotent)
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
                        studentId: studentId || undefined,
                        parentOf: parentOf || undefined,
                        passwordChanged: false
                    });

                    logger.info(`[AUTH] User created in Auth DB → ${email}`);
                } else {
                    logger.info(`[AUTH] User exists → Syncing fields for ${email}`);

                    if (studentId && !user.studentId) user.studentId = studentId;
                    if (parentOf?.length) {
                        user.parentOf = [...new Set([...(user.parentOf || []), ...parentOf])];
                    }
                    if (!user.collegeId) user.collegeId = collegeId;

                    await user.save();
                }

                await notificationQueue.add(
                    "OneTimePassword",
                    {
                        email,
                        name,
                        role,
                        tempory_password: rawPassword,
                        audit: {
                            userId: user._id,
                            event: "USER_REGISTERED_OTP_TRIGGERED",
                            metadata: { role }
                        }
                    },
                    { attempts: 5 }
                );

                logger.info(`[AUTH] Email job queued for ${email}`);

            } catch (err) {
                logger.error(`[AUTH] Error handling USER_REGISTERED for ${data.email}: ${err.message}`);
            }
        });
    }

    async consumeAdminAction() {
        await rabbitMQ.consume(this.queues.ADMIN_ACTION, async (data) => {
            try {
                logger.info(`[RMQ] ADMIN_ACTION → ${data.action}`);
            } catch (err) {
                logger.error(`[AUTH] Error in ADMIN_ACTION: ${err.message}`);
            }
        });
    }

    async consumeCollegeEmailVerification() {
        await rabbitMQ.consume(this.queues.COLLEGE_EMAIL_VERIFICATION, async (data) => {
            try {
                logger.info(`[RMQ] COLLEGE_EMAIL_VERIFICATION → ${data.email}`);

                await notificationQueue.add(
                    "CollegeVerificationEmail",
                    {
                        ...data,
                        audit: {
                            event: "COLLEGE_VERIFICATION_EMAIL_SENT",
                            metadata: { email: data.email }
                        }
                    }
                );

                logger.info(`[AUTH] Verification email queued → ${data.email}`);

            } catch (err) {
                logger.error(`[AUTH] Error in COLLEGE_EMAIL_VERIFICATION: ${err.message}`);
            }
        });
    }
}



export default new MQService();
