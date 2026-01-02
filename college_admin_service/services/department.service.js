import DepartmentMember from "../models/DepartmentMember.model.js";
import Subject from "../models/Subject.model.js";
import { DEPARTMENT_ROLES } from "../utils/roles.config.js";
import { createAudit } from "../utils/audit.js";
import MQService from "../services/mq.service.js";
import { randomUUID } from "crypto";

/* ---------------- FACULTY ---------------- */

export const assignFaculty = async ({
    email,
    name,
    role,
    collegeId,
    departmentId,
    addedBy
}) => {
    if (!DEPARTMENT_ROLES[role]) {
        throw new Error("Invalid department role");
    }


    // Enforce ONE-HOD rule
    if (role === "HOD") {
        const existingHod = await DepartmentMember.findOne({
            collegeId,
            departmentId,
            role: "HOD",
            isActive: true
        });

        if (existingHod) {
            throw new Error(
                "This department already has an assigned HOD. Remove or replace the existing HOD first."
            );
        }
    }

    const alreadyAssigned = await DepartmentMember.findOne({
        collegeId,
        departmentId,
        email,
        isActive: true
    });

    if (alreadyAssigned) {
        throw new Error("User is already assigned to this department");
    }

    await MQService.publishUserOnboardRequested({
        eventId: randomUUID(),
        email,
        name,
        role,
        collegeId,
        departmentId,
        addedBy,
        source: "COLLEGE_SERVICE"
    });

    await createAudit(addedBy, "FACULTY_ONBOARD_REQUESTED", {
        email,
        role,
        departmentId,
        collegeId
    });

    return {
        status: "ONBOARDING_REQUESTED",
        email,
        message: "Your request has been submitted. You’ll receive an update once onboarding is complete."
    };
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
