import MQService from "../services/mq.service.js";
import Student from "../models/Student.model.js";
import logger from "../utils/logger.js";

export async function initCollegeConsumers() {

    // College → Deleting → Suspend students
    await MQService.consumeCollegeDeletion(async ({ collegeId }) => {
        logger.info(
            `[Student] Suspending students for college ${collegeId}`
        );

        await Student.updateMany(
            { collegeId, status: { $ne: "SUSPENDED" } },
            { $set: { status: "SUSPENDED" } }
        );
    });

    // College → Restored → Activate students
    await MQService.consumeCollegeRecover(async ({ collegeId }) => {
        logger.info(
            `[Student] Restoring students for college ${collegeId}`
        );

        await Student.updateMany(
            { collegeId, status: { $ne: "ACTIVE" } },
            { $set: { status: "ACTIVE" } }
        );
    });
}
