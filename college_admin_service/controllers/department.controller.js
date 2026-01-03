import * as DepartmentService from "../services/department.service.js";
import logger from "../utils/logger.js";

/* =========================
   FACULTY
========================= */

export const assignFaculty = async (req, res, next) => {
    try {
        const payload = {
            email: req.body.email,
            name: req.body.name,
            role: req.body.role,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId,
            addedBy: req.user.id
        };

        logger.info("Assign faculty request received", {
            requestId: req.requestId,
            ...payload
        });

        const result = await DepartmentService.assignFaculty(payload);

        logger.info("Faculty assigned successfully", {
            requestId: req.requestId,
            collegeId: payload.collegeId,
            departmentId: payload.departmentId,
            email: payload.email,
            role: payload.role
        });

        res.status(202).json({ success: true, result });
    } catch (err) {
        logger.error("Assign faculty failed", {
            requestId: req.requestId,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId,
            message: err.message,
            stack: err.stack
        });
        next(err);
    }
};

export const removeFaculty = async (req, res, next) => {
    try {
        await DepartmentService.removeFaculty({
            userId: req.params.userId,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId
        });

        logger.info("Faculty removed", {
            requestId: req.requestId,
            userId: req.params.userId,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId
        });

        res.json({ success: true });
    } catch (err) {
        logger.error("Remove faculty failed", {
            requestId: req.requestId,
            userId: req.params.userId,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId,
            message: err.message,
            stack: err.stack
        });
        next(err);
    }
};

export const listFaculty = async (req, res, next) => {
    try {
        const faculty = await DepartmentService.listFaculty({
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId
        });

        logger.info("Faculty list fetched", {
            requestId: req.requestId,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId,
            count: faculty.length
        });

        res.json({ success: true, faculty });
    } catch (err) {
        logger.error("List faculty failed", {
            requestId: req.requestId,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId,
            message: err.message,
            stack: err.stack
        });
        next(err);
    }
};

export const updateFacultyRole = async (req, res, next) => {
    try {
        const member = await DepartmentService.updateFacultyRole({
            userId: req.params.userId,
            role: req.body.role,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId
        });

        logger.info("Faculty role updated", {
            requestId: req.requestId,
            userId: req.params.userId,
            newRole: req.body.role,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId
        });

        res.json({ success: true, member });
    } catch (err) {
        logger.error("Update faculty role failed", {
            requestId: req.requestId,
            userId: req.params.userId,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId,
            message: err.message,
            stack: err.stack
        });
        next(err);
    }
};

/* =========================
   SUBJECTS
========================= */

export const createSubject = async (req, res, next) => {
    try {
        const subject = await DepartmentService.createSubject({
            ...req.body,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId
        });

        logger.info("Subject created", {
            requestId: req.requestId,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId,
            subjectId: subject._id
        });

        res.status(201).json({ success: true, subject });
    } catch (err) {
        logger.error("Create subject failed", {
            requestId: req.requestId,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId,
            payload: req.body,
            message: err.message,
            stack: err.stack
        });
        next(err);
    }
};

export const listSubjects = async (req, res, next) => {
    try {
        const subjects = await DepartmentService.listSubjects({
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId
        });

        logger.info("Subjects fetched", {
            requestId: req.requestId,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId,
            count: subjects.length
        });

        res.json({ success: true, subjects });
    } catch (err) {
        logger.error("List subjects failed", {
            requestId: req.requestId,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId,
            message: err.message,
            stack: err.stack
        });
        next(err);
    }
};

export const updateSubject = async (req, res, next) => {
    try {
        const subject = await DepartmentService.updateSubject({
            subjectId: req.params.subjectId,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId,
            update: req.body
        });

        logger.info("Subject updated", {
            requestId: req.requestId,
            subjectId: req.params.subjectId,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId
        });

        res.json({ success: true, subject });
    } catch (err) {
        logger.error("Update subject failed", {
            requestId: req.requestId,
            subjectId: req.params.subjectId,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId,
            message: err.message,
            stack: err.stack
        });
        next(err);
    }
};

export const deleteSubject = async (req, res, next) => {
    try {
        await DepartmentService.deleteSubject({
            subjectId: req.params.subjectId,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId
        });

        logger.info("Subject deleted", {
            requestId: req.requestId,
            subjectId: req.params.subjectId,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId
        });

        res.json({ success: true });
    } catch (err) {
        logger.error("Delete subject failed", {
            requestId: req.requestId,
            subjectId: req.params.subjectId,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId,
            message: err.message,
            stack: err.stack
        });
        next(err);
    }
};

/* =========================
   STUDENTS
========================= */

export const listStudents = async (req, res, next) => {
    try {
        const students = await DepartmentService.listStudents({
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId
        });

        logger.info("Department students fetched", {
            requestId: req.requestId,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId,
            count: students.length
        });

        res.json({ success: true, students });
    } catch (err) {
        logger.error("List students failed", {
            requestId: req.requestId,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId,
            message: err.message,
            stack: err.stack
        });
        next(err);
    }
};
