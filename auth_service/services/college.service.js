import axios from "axios";
import logger from "../utils/logger.js";

const COLLEGE_SERVICE_URL =
    process.env.COLLEGE_SERVICE_URL || "https://schoolsuite.site/api/college";

export const validateCollege = async (collegeId) => {
    try {
        const response = await axios.get(`${COLLEGE_SERVICE_URL}/${collegeId}`, {
            timeout: 5000
        });

        logger.info("College validated", {
            category: "external_service",
            action: "validate_college",
            collegeId,
            statusCode: response.status
        });

        return response.data.college;
    } catch (err) {
        // College not found → normal business case
        if (err.response?.status === 404) {
            logger.warn("College not found during validation", {
                category: "external_service",
                action: "validate_college",
                collegeId,
                statusCode: 404
            });
            return null;
        }

        // Real failure → infra / network / service down
        logger.error("College validation failed", {
            category: "external_service",
            action: "validate_college",
            collegeId,
            statusCode: err.response?.status,
            message: err.message,
            stack: err.stack
        });

        throw new Error("Failed to validate college");
    }
};
