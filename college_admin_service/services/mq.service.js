import rabbitMQ from "../utils/rabbitmq.js";
import logger from "../utils/logger.js";

// Ensure RMQ connection is established ONCE
await rabbitMQ.connect();

class MQService {
    constructor() {
        this.queues = {
            COLLEGE_CREATED: "college_created",
            USER_REGISTERED: "user_registered",
            ADMIN_ACTION: "admin_action",
            COLLEGE_CREATED_FIRST_EMAIL: "college_email_verification"
        };
    }

    /* -------------------- PUBLISH EVENTS -------------------- */

    async publishCollegeCreated(collegeData) {
        const ok = await rabbitMQ.publish(this.queues.COLLEGE_CREATED, collegeData);

        if (!ok) {
            logger.error(`[RMQ] FAILED → college_created for ${collegeData.name}`);
            return;
        }

        logger.info(`[RMQ] Published college_created for ${collegeData.name}`);
    }

    async publishSendCollegeVerificationEmail(collegeData) {
        const ok = await rabbitMQ.publish(this.queues.COLLEGE_CREATED_FIRST_EMAIL, collegeData);

        if (!ok) {
            logger.error(`[RMQ] FAILED → college_created for ${collegeData.name}`);
            return;
        }

        logger.info(`[RMQ] Published college_created for ${collegeData.name}`);
    }

    async publishAdminAction(actionData) {
        const ok = await rabbitMQ.publish(this.queues.ADMIN_ACTION, actionData);

        if (!ok) {
            logger.error(`[RMQ] FAILED → admin_action: ${actionData.action}`);
            return;
        }

        logger.info(`[RMQ] Published admin_action event: ${actionData.action}`);
    }

    async publishUserRegistered(userData) {
        const ok = await rabbitMQ.publish(this.queues.USER_REGISTERED, userData);

        if (!ok) {
            logger.error(`[RMQ] FAILED → user_registered for ${userData.email}`);
            return;
        }

        logger.info(`[RMQ] Published user_registered for ${userData.email}`);
    }

    /* -------------------- CONSUME EVENTS -------------------- */

    async consumeUserRegistered(callback) {
        await rabbitMQ.consume(this.queues.USER_REGISTERED, async (data) => {
            try {
                logger.info(`[RMQ] USER_REGISTERED event for ${data.email}`);
                await callback(data);  // SAFE async callback
            } catch (err) {
                logger.error(`[RMQ] USER_REGISTERED handler failed for ${data.email}: ${err.message}`);
            }
        });
    }
}

export default new MQService();
