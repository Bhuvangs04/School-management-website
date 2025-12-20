import express from "express";
import * as AdminController from "../controllers/admin.controller.js";
import upload from "../middleware/fileLimiter.js";
import * as Access from "../middleware/requireRole.js";
import verifyAccess from "../middleware/verifyAccess.js";


const router = express.Router();


router.use(verifyAccess);

router.post("/:collegeId/upload-students", Access.requireRole(["college_admin", "super_admin"]), Access.requireCollegeAccess(), upload.single("file"), AdminController.uploadStudents);
router.get("/:collegeId/upload-status/:id", Access.requireRole(["college_admin", "super_admin"]), Access.requireCollegeAccess(), AdminController.getUploadStatus);
router.get("/:collegeId/upload-report/:id", Access.requireRole(["college_admin", "super_admin"]), Access.requireCollegeAccess(), AdminController.downloadReport);
router.get("/:collegeId/students", Access.requireRole(["college_admin", "super_admin"]), Access.requireCollegeAccess(), AdminController.listStudents);
router.post("/:collegeId/students/:id/assign-parent", Access.requireRole(["college_admin", "super_admin"]), Access.requireCollegeAccess(), AdminController.assignParent);
router.post("/:collegeId/departments", Access.requireRole(["college_admin", "super_admin"]), Access.requireCollegeAccess(), AdminController.addDepartment);
router.put("/:collegeId/departments/:departmentId", Access.requireRole(["college_admin", "super_admin"]), Access.requireCollegeAccess(), AdminController.updateDepartment);
router.delete("/:collegeId/departments/:departmentId", Access.requireRole(["college_admin", "super_admin"]), Access.requireCollegeAccess(), AdminController.deleteDepartment);

export default router;
