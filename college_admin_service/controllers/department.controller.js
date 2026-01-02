import * as DepartmentService from "../services/department.service.js";

/* -------- FACULTY -------- */

export const assignFaculty = async (req, res, next) => {
    try {
        const result = await DepartmentService.assignFaculty({
            email: req.body.email,
            name: req.body.name,
            role: req.body.role,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId,
            addedBy: req.user._id
        });

        res.status(202).json({ success: true, result });
    } catch (err) {
        console.log(err);
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

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

export const listFaculty = async (req, res, next) => {
    try {
        const faculty = await DepartmentService.listFaculty({
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId
        });

        res.json({ success: true, faculty });
    } catch (err) {
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

        res.json({ success: true, member });
    } catch (err) {
        next(err);
    }
};

/* -------- SUBJECTS -------- */

export const createSubject = async (req, res, next) => {
    try {
        const subject = await DepartmentService.createSubject({
            ...req.body,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId
        });

        res.status(201).json({ success: true, subject });
    } catch (err) {
        next(err);
    }
};

export const listSubjects = async (req, res, next) => {
    try {
        const subjects = await DepartmentService.listSubjects({
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId
        });

        res.json({ success: true, subjects });
    } catch (err) {
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

        res.json({ success: true, subject });
    } catch (err) {
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

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
};

/* -------- STUDENTS -------- */

export const listStudents = async (req, res, next) => {
    try {
        const students = await DepartmentService.listStudents({
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId
        });

        res.json({ success: true, students });
    } catch (err) {
        next(err);
    }
};
