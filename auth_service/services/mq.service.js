import rabbitMQ from '../utils/rabbitmq.js';
import User from '../models/user.model.js';
import { notificationQueue } from "../queues/notification.queue.js"; 
import logger from "../utils/logger.js";
import { makeTempPassword, hashPassword } from "../utils/password.js"

class MQService {
    constructor() {
        this.queues = {
            COLLEGE_CREATED: 'college_created',
            USER_REGISTERED: 'user_registered'
        };
    }

    async init() {
        await rabbitMQ.connect();
        this.consumeCollegeCreated();
        this.consumeUserRegistered();
    }

    async consumeCollegeCreated() {
        await rabbitMQ.consume(this.queues.COLLEGE_CREATED, (data) => {
            logger.info(`Received college created event for ${data.name}`);
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
}

export default new MQService();
