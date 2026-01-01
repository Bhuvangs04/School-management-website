import * as AdminService from "../services/admin.service.js";

export const uploadStudents = async (req, res, next) => {
    try {
        const file = req.file;
        if (!file) {
            const error = new Error("File required");
            error.statusCode = 400;
            throw error;
        }

        const job = await AdminService.createUploadJob(req.params.collegeId, req.user.id, file);
        res.status(202).json({ success: true, jobId: job._id });
    } catch (err) {
        next(err);
    }
};

export const getUploadStatus = async (req, res, next) => {
    try {
        const job = await AdminService.getUploadJobById(req.params.id);
        if (!job) {
            const error = new Error("Job not found");
            error.statusCode = 404;
            throw error;
        }
        res.json({ success: true, job });
    } catch (err) {
        next(err);
    }
};

export const downloadReport = async (req, res, next) => {
    try {
        const job = await AdminService.getUploadJobById(req.params.id);
        if (!job || !job.reportPath) {
            const error = new Error("Report not ready");
            error.statusCode = 404;
            throw error;
        }
        res.download(job.reportPath);
    } catch (err) {
        next(err);
    }
};

export const listStudents = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page || "1", 10);
        const limit = parseInt(req.query.limit || "50", 10);
        const students = await AdminService.getStudents(req.params.collegeId, page, limit);
        res.json({ success: true, students });
    } catch (err) {
        next(err);
    }
};

export const assignParent = async (req, res, next) => {
    try {
        await AdminService.assignParentToStudent(req.params.collegeId, req.params.id, req.body.parentId);
        res.json({ success: true });
    } catch (err) {
        if (err.message === "Student not found") err.statusCode = 404;
        if (err.message === "College mismatch") err.statusCode = 400;
        next(err);
    }
};

export const getDepartment = async (req, res) => {
    try {
        const { collegeId } = req.params;
        const departments = await AdminService.getDepartmentsWithHod(collegeId);
        res.status(201).json({ success: true, departments });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

export const addDepartment = async (req, res) => {
    try {
        const { collegeId } = req.params;
        console.log(collegeId)
        const departments = await AdminService.addDepartment(collegeId, req.body);
        console.log(departments)
        res.status(201).json({ success: true, departments });
    } catch (err) {
        console.log(err)
        res.status(400).json({ success: false, message: err.message });
    }
};

export const updateDepartment = async (req, res) => {
    try {
        const { collegeId, departmentId } = req.params;
        const department = await AdminService.updateDepartment(
            collegeId,
            departmentId,
            req.body
        );
        res.json({ success: true, department });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

export const deleteDepartment = async (req, res) => {
    try {
        const { collegeId, departmentId } = req.params;
        await AdminService.deleteDepartment(collegeId, departmentId);
        res.json({ success: true, message: "Department deleted" });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};



