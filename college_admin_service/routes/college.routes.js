import {
    createCollege,
    getCollege,
    updateCollege,
    deleteCollege
} from "../controllers/college.controller.js";
import validate from "../middleware/validate.js";
import { createCollegeSchema, updateCollegeSchema, getByIdSchema } from "../utils/validationSchemas.js";
import verifyAccess from "../middleware/verifyAccess.js";
import requireRole from "../middleware/requireRole.js";
import express from "express";

const router = express.Router();


// Public routes (or protect if needed)
router.get("/:id", validate(getByIdSchema), getCollege);

// Protected routes
router.use(verifyAccess);
router.post("/", requireRole("super_admin"), validate(createCollegeSchema), createCollege);
router.put("/:id", requireRole("super_admin"), validate(updateCollegeSchema), updateCollege);
router.delete("/:id", requireRole("super_admin"), validate(getByIdSchema), deleteCollege);

export default router;
