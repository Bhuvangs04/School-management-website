import express from "express";
import { register, login, refreshToken, sendOtp, resetPassword, verifyToken, changePassword, logout } from "../controllers/auth.controller.js";
const router = express.Router();

import { authenticate } from "../middlewares/auth.middleware.js"

router.use(authenticate)
router.post("/send-otp", sendOtp);
router.post("/reset-password", resetPassword);
router.put("/change-password", changePassword);
router.post("/logout", logout);


export default router;
