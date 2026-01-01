import rabbitMQ from "../utils/rabbitmq.js";
import logger from "../utils/logger.js";


class MQService {
    constructor() {
        // FANOUT EXCHANGES (shared events)
        this.exchanges = {
            COLLEGE_EVENTS: "college.events",
            USER_EVENTS: "user.events",
        };

        // SERVICE-SPECIFIC QUEUES
        this.queues = {
            AUTH_COLLEGE_EVENTS: "auth.college.events",
            COLLEGE_COLLEGE_EVENTS: "college.college.events",
            USER_REGISTERED: "user_registered", // point-to-point is fine here
            AUTH_USER_EVENTS: "auth.user.events",
            COLLEGE_USER_EVENTS: "college.user.events",
            ADMIN_ACTION: "admin_action",
            COLLEGE_CREATED_FIRST_EMAIL: "college_email_verification",
        };
    }

    async init() {
        await rabbitMQ.connect();
        logger.info("[RMQ] Connected successfully");
    }

    /* -------------------- PUBLISH EVENTS -------------------- */

    // 🔁 FANOUT — both services MUST receive this
    async publishCollegeCreated(collegeData) {
        await rabbitMQ.publishFanout(
            this.exchanges.COLLEGE_EVENTS,
            {
                type: "COLLEGE_CREATED",
                payload: collegeData
            }
        );

        logger.info(`[RMQ] Fanout → COLLEGE_CREATED for ${collegeData.name}`);
    }

    // 🔁 FANOUT — deletion affects auth + college services
    async publishCollegeDeletion(collegeData) {
        await rabbitMQ.publishFanout(
            this.exchanges.COLLEGE_EVENTS,
            {
                type: "COLLEGE_DELETION",
                payload: collegeData
            }
        );

        logger.info(`[RMQ] Fanout → COLLEGE_DELETION for ${collegeData.name}`);
    }

    // 🔁 FANOUT — recovery affects auth + college services
    async publishCollegeRecover(collegeData) {
        await rabbitMQ.publishFanout(
            this.exchanges.COLLEGE_EVENTS,
            {
                type: "COLLEGE_RECOVER",
                payload: collegeData
            }
        );

        logger.info(`[RMQ] Fanout → COLLEGE_RECOVER for ${collegeData.name}`);
    }

    // ✅ QUEUE — only auth service cares
    async publishUserRegistered(userData) {
        await rabbitMQ.publish(this.queues.USER_REGISTERED, userData);
        logger.info(`[RMQ] Queue → USER_REGISTERED for ${userData.email}`);
    }

    //  College → Auth (request user creation)
    async publishUserOnboardRequested(payload) {
        await rabbitMQ.publishFanout(
            this.exchanges.USER_EVENTS,
            {
                type: "USER_ONBOARD_REQUESTED",
                payload
            }
        );

        logger.info(
            `[RMQ] Fanout → USER_ONBOARD_REQUESTED for ${payload.email}`
        );
    }

    // Auth → College (confirm user created)
    async publishUserOnboarded(payload) {
        await rabbitMQ.publishFanout(
            this.exchanges.USER_EVENTS,
            {
                type: "USER_ONBOARDED",
                payload
            }
        );

        logger.info(
            `[RMQ] Fanout → USER_ONBOARDED for ${payload.userId}`
        );
    }

    // ✅ QUEUE — only notification/email service
    async publishSendCollegeVerificationEmail(collegeData) {
        await rabbitMQ.publish(
            this.queues.COLLEGE_CREATED_FIRST_EMAIL,
            collegeData
        );

        logger.info(
            `[RMQ] Queue → COLLEGE_EMAIL_VERIFICATION for ${collegeData.name}`
        );
    }

    // ✅ QUEUE — admin actions are single-consumer
    async publishAdminAction(actionData) {
        await rabbitMQ.publish(this.queues.ADMIN_ACTION, actionData);
        logger.info(`[RMQ] Queue → ADMIN_ACTION ${actionData.action}`);
    }

    /* -------------------- CONSUME EVENTS -------------------- */

    // ✅ POINT-TO-POINT CONSUME
    async consumeUserRegistered(callback) {
        await rabbitMQ.consume(
            this.queues.USER_REGISTERED,
            async (data) => {
                logger.info(`[RMQ] USER_REGISTERED → ${data.email}`);
                await callback(data);
            }
        );
    }

    /* -------------------- FANOUT CONSUMERS -------------------- */
    // 🔁 AUTH SERVICE should call this
    async consumeCollegeEventsForAuth(callback) {
        await rabbitMQ.consumeFanout(
            this.exchanges.COLLEGE_EVENTS,
            this.queues.AUTH_COLLEGE_EVENTS,
            async (event) => {
                logger.info(
                    `[RMQ][AUTH] ${event.type} → ${event.payload.collegeId}`
                );
                await callback(event);
            }
        );
    }

    // 🔁 COLLEGE SERVICE should call this
    async consumeCollegeEventsForCollege(callback) {
        await rabbitMQ.consumeFanout(
            this.exchanges.COLLEGE_EVENTS,
            this.queues.COLLEGE_COLLEGE_EVENTS,
            async (event) => {
                logger.info(
                    `[RMQ][COLLEGE] ${event.type} → ${event.payload.collegeId}`
                );
                await callback(event);
            }
        );
    }

    async consumeUserEventsForAuth(callback) {
        await rabbitMQ.consumeFanout(
            this.exchanges.USER_EVENTS,
            this.queues.AUTH_USER_EVENTS,
            async (event) => {
                logger.info(`[RMQ][AUTH] ${event.type}`);
                await callback(event);
            }
        );
    }


    async consumeUserEventsForCollege(callback) {
        await rabbitMQ.consumeFanout(
            this.exchanges.USER_EVENTS,
            this.queues.COLLEGE_USER_EVENTS,
            async (event) => {
                logger.info(`[RMQ][COLLEGE] ${event.type}`);
                await callback(event);
            }
        );
    }
}

export default new MQService();
