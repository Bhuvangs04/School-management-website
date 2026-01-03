import * as AdminService from "../services/admin.service.js";
import logger from "../utils/logger.js";

/**
 * Upload students file
 */
export const uploadStudents = async (req, res, next) => {
    try {
        const file = req.file;

        if (!file) {
            logger.warn("Upload students failed - file missing", {
                requestId: req.requestId,
                collegeId: req.params.collegeId,
                userId: req.user?.id
            });

            const error = new Error("File required");
            error.statusCode = 400;
            throw error;
        }

        const job = await AdminService.createUploadJob(
            req.params.collegeId,
            req.user.id,
            file
        );

        logger.info("Student upload job created", {
            requestId: req.requestId,
            collegeId: req.params.collegeId,
            userId: req.user.id,
            jobId: job._id,
            fileName: file.originalname
        });

        res.status(202).json({ success: true, jobId: job._id });
    } catch (err) {
        logger.error("Upload students error", {
            requestId: req.requestId,
            collegeId: req.params.collegeId,
            userId: req.user?.id,
            message: err.message,
            stack: err.stack
        });
        next(err);
    }
};

/**
 * Get upload job status
 */
export const getUploadStatus = async (req, res, next) => {
    try {
        const job = await AdminService.getUploadJobById(req.params.id);

        if (!job) {
            logger.warn("Upload job not found", {
                requestId: req.requestId,
                jobId: req.params.id
            });

            const error = new Error("Job not found");
            error.statusCode = 404;
            throw error;
        }

        res.json({ success: true, job });
    } catch (err) {
        logger.error("Get upload status failed", {
            requestId: req.requestId,
            jobId: req.params.id,
            message: err.message,
            stack: err.stack
        });
        next(err);
    }
};

/**
 * Download upload report
 */
export const downloadReport = async (req, res, next) => {
    try {
        const job = await AdminService.getUploadJobById(req.params.id);

        if (!job || !job.reportPath) {
            logger.warn("Report not ready", {
                requestId: req.requestId,
                jobId: req.params.id
            });

            const error = new Error("Report not ready");
            error.statusCode = 404;
            throw error;
        }

        logger.info("Upload report downloaded", {
            requestId: req.requestId,
            jobId: req.params.id,
            reportPath: job.reportPath
        });

        res.download(job.reportPath);
    } catch (err) {
        logger.error("Download report failed", {
            requestId: req.requestId,
            jobId: req.params.id,
            message: err.message,
            stack: err.stack
        });
        next(err);
    }
};

/**
 * List students
 */
export const listStudents = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page || "1", 10);
        const limit = parseInt(req.query.limit || "50", 10);

        const students = await AdminService.getStudents(
            req.params.collegeId,
            page,
            limit
        );

        logger.info("Students listed", {
            requestId: req.requestId,
            collegeId: req.params.collegeId,
            page,
            limit,
            count: students?.length
        });

        res.json({ success: true, students });
    } catch (err) {
        logger.error("List students failed", {
            requestId: req.requestId,
            collegeId: req.params.collegeId,
            message: err.message,
            stack: err.stack
        });
        next(err);
    }
};

/**
 * Assign parent to student
 */
export const assignParent = async (req, res, next) => {
    try {
        await AdminService.assignParentToStudent(
            req.params.collegeId,
            req.params.id,
            req.body.parentId
        );

        logger.info("Parent assigned to student", {
            requestId: req.requestId,
            collegeId: req.params.collegeId,
            studentId: req.params.id,
            parentId: req.body.parentId
        });

        res.json({ success: true });
    } catch (err) {
        if (err.message === "Student not found") err.statusCode = 404;
        if (err.message === "College mismatch") err.statusCode = 400;

        logger.error("Assign parent failed", {
            requestId: req.requestId,
            collegeId: req.params.collegeId,
            studentId: req.params.id,
            parentId: req.body.parentId,
            message: err.message,
            stack: err.stack
        });

        next(err);
    }
};

/**
 * Get departments with HOD
 */
export const getDepartment = async (req, res, next) => {
    try {
        const departments = await AdminService.getDepartmentsWithHod(
            req.params.collegeId
        );

        logger.info("Departments fetched", {
            requestId: req.requestId,
            collegeId: req.params.collegeId,
            count: departments?.length
        });

        res.status(200).json({ success: true, departments });
    } catch (err) {
        logger.error("Get departments failed", {
            requestId: req.requestId,
            collegeId: req.params.collegeId,
            message: err.message,
            stack: err.stack
        });
        next(err);
    }
};

/**
 * Add department
 */
export const addDepartment = async (req, res, next) => {
    try {
        const departments = await AdminService.addDepartment(
            req.params.collegeId,
            req.body
        );

        logger.info("Department added", {
            requestId: req.requestId,
            collegeId: req.params.collegeId,
            payload: req.body
        });

        res.status(201).json({ success: true, departments });
    } catch (err) {
        logger.error("Add department failed", {
            requestId: req.requestId,
            collegeId: req.params.collegeId,
            message: err.message,
            stack: err.stack
        });
        next(err);
    }
};

/**
 * Update department
 */
export const updateDepartment = async (req, res, next) => {
    try {
        const department = await AdminService.updateDepartment(
            req.params.collegeId,
            req.params.departmentId,
            req.body
        );

        logger.info("Department updated", {
            requestId: req.requestId,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId
        });

        res.json({ success: true, department });
    } catch (err) {
        logger.error("Update department failed", {
            requestId: req.requestId,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId,
            message: err.message,
            stack: err.stack
        });
        next(err);
    }
};

/**
 * Delete department
 */
export const deleteDepartment = async (req, res, next) => {
    try {
        await AdminService.deleteDepartment(
            req.params.collegeId,
            req.params.departmentId
        );

        logger.info("Department deleted", {
            requestId: req.requestId,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId
        });

        res.json({ success: true, message: "Department deleted" });
    } catch (err) {
        logger.error("Delete department failed", {
            requestId: req.requestId,
            collegeId: req.params.collegeId,
            departmentId: req.params.departmentId,
            message: err.message,
            stack: err.stack
        });
        next(err);
    }
};
