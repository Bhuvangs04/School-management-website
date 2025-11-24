import {
    createCollege,
    getCollege,
    updateCollege,
    deleteCollege,
    applyForCollege,
    verifyCollegeEmail,
    getApplications,
    approveCollege
} from "../controllers/college.controller.js";
import validate from "../middleware/validate.js";
import { createCollegeSchema, updateCollegeSchema, getByIdSchema } from "../utils/validationSchemas.js";
import verifyAccess from "../middleware/verifyAccess.js";
import requireRole from "../middleware/requireRole.js";
import express from "express";

const router = express.Router();


// Public routes (or protect if needed)
router.post("/apply", applyForCollege);
router.get("/verify-email", verifyCollegeEmail);
router.get("/:id", validate(getByIdSchema), getCollege);

// Protected routes
router.use(verifyAccess);
router.get("/applications", requireRole("super_admin"), getApplications);
router.post("/approve", requireRole("super_admin"), approveCollege);
router.post("/", requireRole("super_admin"), validate(createCollegeSchema), createCollege);
router.put("/:id", requireRole("super_admin"), validate(updateCollegeSchema), updateCollege);
router.delete("/:id", requireRole("super_admin"), validate(getByIdSchema), deleteCollege);

export default router;
