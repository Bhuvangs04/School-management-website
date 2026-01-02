import MQService from "../services/mq.service.js";
import Student from "../models/Student.model.js";
import { DEPARTMENT_ROLES } from "../utils/roles.config.js";
import DepartmentMember from "../models/DepartmentMember.model.js";
import logger from "../utils/logger.js";
import ProcessedEvent from "../models/ProcessedEvent.model.js";


export async function initCollegeConsumers() {


    // college service consumes USER lifecycle events from auth
    await MQService.consumeUserEventsForCollege(async (event) => {

        const { type, payload } = event;

        switch (type) {

            case "USER_ONBOARDED": {
                const {
                    eventId,
                    userId,
                    name,
                    email,
                    collegeId,
                    departmentId,
                    role,
                    addedBy
                } = payload;

                const alreadyProcessed = await ProcessedEvent.findOne({ eventId });
                if (alreadyProcessed) {
                    logger.warn(`[DEPARTMENT] Duplicate USER_ONBOARDED ignored: ${eventId}`);
                    return;
                }

                const permissions = DEPARTMENT_ROLES[role];
                if (!permissions) {
                    logger.error(`[DEPARTMENT] Invalid role in USER_ONBOARDED: ${role}`);
                    return;
                }

                try {
                    await DepartmentMember.findOneAndUpdate(
                        { userId, departmentId },
                        {
                            userId,
                            collegeId,
                            name,
                            email,
                            departmentId,
                            role,
                            permissions,
                            addedBy,
                            isActive: true
                        },
                        { upsert: true, new: true }
                    );
                } catch (err) {
                    if (err.code === 11000 && role === "HOD") {
                        logger.warn(
                            `[DEPARTMENT] HOD already exists for department ${departmentId}`
                        );
                        return;
                    }
                    throw err;
                }

                await ProcessedEvent.create({ eventId });

                logger.info(
                    `[DEPARTMENT] USER_ONBOARDED → member synced ${userId}`
                );
                break;
            }

            default:
                logger.warn(`[DEPARTMENT] Unknown USER event: ${type}`);
        }
    });

    logger.info("[DEPARTMENT] User event consumer initialized");


    // FANOUT — college service gets ALL college events
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
