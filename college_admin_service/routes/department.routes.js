// routes/department.routes.js
import express from "express";
import verifyAccess from "../middleware/verifyAccess.js";
import requireDepartmentPermission from "../middleware/requireDepartmentPermission.js";
import * as DepartmentController from "../controllers/department.controller.js";

const router = express.Router({ mergeParams: true });

router.use(verifyAccess);

// Faculty
router.post(
    "/faculty/assign",
    requireDepartmentPermission("canAddTeacher"),
    DepartmentController.assignFaculty
);

router.delete(
    "/faculty/:userId",
    requireDepartmentPermission("canRemoveTeacher"),
    DepartmentController.removeFaculty
);

router.get(
    "/faculty",
    requireDepartmentPermission("canViewStudents"),
    DepartmentController.listFaculty
);

// Subjects
router.post(
    "/subjects",
    requireDepartmentPermission("canAssignSubjects"),
    DepartmentController.createSubject
);

// Students
router.get(
    "/students",
    requireDepartmentPermission("canViewStudents"),
    DepartmentController.listStudents
);

// Marks
router.post(
    "/marks/upload",
    requireDepartmentPermission("canUploadMarks"),
    DepartmentController.uploadMarks
);

export default router;
