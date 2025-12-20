import {
    createCollege,
    getCollege,
    updateCollege,
    deleteCollege,
    applyForCollege,
    verifyCollegeEmail,
    getApplications,
    approveCollege,
    recoverCollege
} from "../controllers/college.controller.js";
import validate from "../middleware/validate.js";
import { createCollegeSchema, updateCollegeSchema, getByIdSchema } from "../utils/validationSchemas.js";
import verifyAccess from "../middleware/verifyAccess.js";
import requireRole from "../middleware/requireRole.js";
import { recoveryRateLimit } from "../middleware/recoveryRateLimit.js";
import express from "express";

const router = express.Router();


// Public routes (or protect if needed)
router.post("/apply", applyForCollege);
router.get("/verify-email", verifyCollegeEmail);
router.get("/:id", validate(getByIdSchema), getCollege);
router.post("/recover", recoveryRateLimit({ maxAttempts: 5 }), recoverCollege);


// Protected routes
router.use(verifyAccess);
router.get("/admin-only/applications", requireRole("super_admin"), getApplications);
router.post("/admin/approve", requireRole("super_admin"), approveCollege);
router.post("/admin/create-college", requireRole("super_admin"), validate(createCollegeSchema), createCollege);
router.put("/admin/edit/:id", requireRole("super_admin"), validate(updateCollegeSchema), updateCollege);
router.delete("/admin/remove/:id", requireRole("super_admin"), validate(getByIdSchema), deleteCollege);

export default router;
