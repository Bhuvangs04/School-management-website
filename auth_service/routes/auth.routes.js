import express from "express";
import { register, login, refreshToken, sendOtp, resetPassword, verifyToken, changePassword, logout } from "../controllers/auth.controller.js";
const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refreshToken);
router.post("/send-otp", sendOtp);
router.post("/reset-password", resetPassword);
router.post("/verify", verifyToken); 
router.put("/change-password", changePassword);
router.post("/logout", logout);


export default router;
