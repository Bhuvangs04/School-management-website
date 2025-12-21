import express from "express";
import * as AdminController from "../controllers/admin.controller.js";
import upload from "../middleware/fileLimiter.js";
import requireRole, { requireCollegeAccess } from "../middleware/requireRole.js";
import verifyAccess from "../middleware/verifyAccess.js";


const router = express.Router();


router.use(verifyAccess);

router.post("/:collegeId/upload-students", requireRole(["college_admin", "super_admin"]), requireCollegeAccess(), upload.single("file"), AdminController.uploadStudents);
router.get("/:collegeId/upload-status/:id", requireRole(["college_admin", "super_admin"]), requireCollegeAccess(), AdminController.getUploadStatus);
router.get("/:collegeId/upload-report/:id", requireRole(["college_admin", "super_admin"]), requireCollegeAccess(), AdminController.downloadReport);
router.get("/:collegeId/students", requireRole(["college_admin", "super_admin"]), requireCollegeAccess(), AdminController.listStudents);
router.post("/:collegeId/students/:id/assign-parent", requireRole(["college_admin", "super_admin"]), requireCollegeAccess(), AdminController.assignParent);
router.post("/:collegeId/departments", requireRole(["college_admin", "super_admin"]), requireCollegeAccess(), AdminController.addDepartment);
router.put("/:collegeId/departments/:departmentId", requireRole(["college_admin", "super_admin"]), requireCollegeAccess(), AdminController.updateDepartment);
router.delete("/:collegeId/departments/:departmentId", requireRole(["college_admin", "super_admin"]), requireCollegeAccess(), AdminController.deleteDepartment);

export default router;
