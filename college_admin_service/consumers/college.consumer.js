import MQService from "../services/mq.service.js";
import Student from "../models/Student.model.js";
import logger from "../utils/logger.js";

export async function initCollegeConsumers() {

    // 🔁 FANOUT — college service gets ALL college events
    await MQService.consumeCollegeEventsForCollege(async (event) => {

        const { type, payload } = event;

        switch (type) {

            case "COLLEGE_DELETION": {
                const { collegeId } = payload;

                logger.info(
                    `[STUDENT] COLLEGE_DELETION → suspending students for ${collegeId}`
                );

                await Student.updateMany(
                    { collegeId, status: { $ne: "SUSPENDED" } },
                    { $set: { status: "SUSPENDED" } }
                );
                break;
            }

            case "COLLEGE_RECOVER": {
                const { collegeId } = payload;

                logger.info(
                    `[STUDENT] COLLEGE_RECOVER → restoring students for ${collegeId}`
                );

                await Student.updateMany(
                    { collegeId, status: { $ne: "ACTIVE" } },
                    { $set: { status: "ACTIVE" } }
                );
                break;
            }

            default:
                logger.warn(`[STUDENT] Unknown event type: ${type}`);
        }
    });

    logger.info("[STUDENT] College fanout consumer initialized");
}
