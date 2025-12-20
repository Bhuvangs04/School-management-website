import express from "express";
import * as AdminController from "../controllers/admin.controller.js";
import upload from "../middleware/fileLimiter.js";
import requireRole from "../middleware/requireRole.js";
import verifyAccess from "../middleware/verifyAccess.js";

const router = express.Router();


router.use(verifyAccess);

router.post("/:collegeId/upload-students", requireRole(["college_admin", "super_admin"]), upload.single("file"), AdminController.uploadStudents);
router.get("/upload-status/:id", requireRole(["college_admin", "super_admin"]), AdminController.getUploadStatus);
router.get("/upload-report/:id", requireRole(["college_admin", "super_admin"]), AdminController.downloadReport);
router.get("/:collegeId/students", requireRole(["college_admin", "super_admin"]), AdminController.listStudents);
router.post("/:collegeId/students/:id/assign-parent", requireRole(["college_admin", "super_admin"]), AdminController.assignParent);
router.post("/:collegeId/departments", requireRole(["college_admin", "super_admin"]), AdminController.addDepartment);
router.put("/:collegeId/departments/:departmentId", requireRole(["college_admin", "super_admin"]), AdminController.updateDepartment);
router.delete("/:collegeId/departments/:departmentId", requireRole(["college_admin", "super_admin"]), AdminController.deleteDepartment);

export default router;
