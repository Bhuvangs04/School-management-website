// routes/department.routes.js
import express from "express";
import verifyAccess from "../middleware/verifyAccess.js";
import requireDepartmentPermission from "../middleware/departmentPermission.middleware.js";
import * as DepartmentController from "../controllers/department.controller.js";
import { DEPARTMENT_PERMISSIONS } from "../utils/permissions.constants.js";
import requireRole, { requireCollegeAccess } from "../middleware/requireRole.js";



const router = express.Router({ mergeParams: true });

router.use(verifyAccess);

// Faculty
router.post(
    "/faculty/assign/:collegeId/:departmentId",
    requireRole(["college_admin", "HOD"]),
    requireCollegeAccess,
    requireDepartmentPermission(DEPARTMENT_PERMISSIONS.MANAGE_FACULTY),
    DepartmentController.assignFaculty
);

router.delete(
    "/faculty/:userId/:collegeId/:departmentId",
    requireCollegeAccess,
    requireDepartmentPermission(DEPARTMENT_PERMISSIONS.MANAGE_FACULTY),
    DepartmentController.removeFaculty
);

router.get(
    "/faculty/:collegeId/:departmentId",
    requireCollegeAccess,
    requireDepartmentPermission(DEPARTMENT_PERMISSIONS.MANAGE_STUDENTS),
    DepartmentController.listFaculty
);

// Subjects
router.post(
    "/subjects/:collegeId/:departmentId",
    requireCollegeAccess,
    requireDepartmentPermission(DEPARTMENT_PERMISSIONS.MANAGE_COURSES),
    DepartmentController.createSubject
);

// Students
router.get(
    "/students/:collegeId/:departmentId",
    requireCollegeAccess,
    requireDepartmentPermission(DEPARTMENT_PERMISSIONS.VIEW_REPORTS),
    DepartmentController.listStudents
);

export default router;
