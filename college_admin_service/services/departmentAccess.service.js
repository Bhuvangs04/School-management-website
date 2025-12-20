import DepartmentMember from "../models/DepartmentMember.model.js";
import { DEPARTMENT_ROLES } from "../utils/roles.config.js";

export const assignUserToDepartment = async ({
    userId,
    collegeId,
    departmentId,
    role
}) => {
    const permissions = DEPARTMENT_ROLES[role];
    if (!permissions) throw new Error("Invalid department role");

    return await DepartmentMember.create({
        userId,
        collegeId,
        departmentId,
        role,
        permissions
    });
};
