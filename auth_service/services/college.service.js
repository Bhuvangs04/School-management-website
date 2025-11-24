import axios from "axios";

const COLLEGE_SERVICE_URL = process.env.COLLEGE_SERVICE_URL || "https://school-management-website-production.up.railway.app/api/college";

export const validateCollege = async (collegeId) => {
    try {
        const response = await axios.get(`${COLLEGE_SERVICE_URL}/${collegeId}`);
        return response.data.college;
    } catch (err) {
        if (err.response && err.response.status === 404) {
            return null;
        }
        throw new Error("Failed to validate college: " + err.message);
    }
};
