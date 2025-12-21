import DepartmentMember from "../models/DepartmentMember.model.js";
import Subject from "../models/Subject.model.js";
import User from "../models/User.model.js";
import { DEPARTMENT_ROLES } from "../utils/roles.config.js";

/* ---------------- FACULTY ---------------- */

export const assignFaculty = async ({
    userId,
    collegeId,
    departmentId,
    role
}) => {
    const permissions = DEPARTMENT_ROLES[role];
    if (!permissions) throw new Error("Invalid department role");

    const user = await User.findById(userId).lean();
    if (!user) throw new Error("User not found");

    return await DepartmentMember.create({
        userId,
        collegeId,
        departmentId,
        role,
        permissions
    });
};

export const removeFaculty = async ({ userId, departmentId, collegeId }) => {
    const res = await DepartmentMember.findOneAndDelete({
        userId,
        departmentId,
        collegeId
    });

    if (!res) throw new Error("Faculty not found");
};

export const listFaculty = async ({ departmentId, collegeId }) => {
    return await DepartmentMember.find({
        departmentId,
        collegeId
    })
        .populate("userId", "name email")
        .lean();
};

export const updateFacultyRole = async ({
    userId,
    departmentId,
    collegeId,
    role
}) => {
    const permissions = DEPARTMENT_ROLES[role];
    if (!permissions) throw new Error("Invalid role");

    const member = await DepartmentMember.findOneAndUpdate(
        { userId, departmentId, collegeId },
        { role, permissions },
        { new: true }
    );

    if (!member) throw new Error("Faculty not found");
    return member;
};

/* ---------------- SUBJECTS ---------------- */

export const createSubject = async ({
    name,
    code,
    semester,
    departmentId,
    collegeId
}) => {
    return await Subject.create({
        name,
        code,
        semester,
        departmentId,
        collegeId
    });
};

export const listSubjects = async ({ departmentId, collegeId }) => {
    return await Subject.find({ departmentId, collegeId }).lean();
};

export const updateSubject = async ({
    subjectId,
    departmentId,
    collegeId,
    update
}) => {
    const subject = await Subject.findOneAndUpdate(
        { _id: subjectId, departmentId, collegeId },
        update,
        { new: true }
    );

    if (!subject) throw new Error("Subject not found");
    return subject;
};

export const deleteSubject = async ({
    subjectId,
    departmentId,
    collegeId
}) => {
    const res = await Subject.findOneAndDelete({
        _id: subjectId,
        departmentId,
        collegeId
    });

    if (!res) throw new Error("Subject not found");
};

/* ---------------- STUDENTS (READ ONLY) ---------------- */

export const listStudents = async ({ departmentId, collegeId }) => {
    return await Student.find({
        departmentId,
        collegeId
    })
        .select("name email rollNo")
        .lean();
};
